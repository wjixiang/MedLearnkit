import logging
import os
import shutil
import time
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from openai import OpenAI

from lib.chunker import chunk, chunk_by_docling
from lib.converter import Converter
from lib.embedder import Embedder
from lib.models import (
    ChatMessage,
    ChunkResult,
    EmbeddingVersion,
    NotebookMeta,
)
from lib.retriever import Retriever
from lib.storage import Storage
from lib.vector_store import VectorStore

logger = logging.getLogger(__name__)


class EmbeddingError(Exception):
    """Raised when embedding operation fails."""
    pass


class NotebookService:
    def __init__(
        self,
        storage: Storage,
        converter: Converter | None = None,
        embedder: Embedder | None = None,
        lance_db_uri: str = "/tmp/notebook-rag-lance",
        lance_storage_options: dict | None = None,
    ):
        self._storage = storage
        self._converter = converter or Converter()
        self._embedder = embedder or Embedder()
        self._lance_db_uri = lance_db_uri
        self._lance_storage_options = lance_storage_options or {}

    def convert(self, source_path: str, notebook_id: str | None = None) -> NotebookMeta:
        if notebook_id is None:
            notebook_id = uuid.uuid4().hex[:12]

        filename = os.path.basename(source_path)
        ext = filename.rsplit(".", 1)[-1].lower()
        logger.info("[convert] notebook_id=%s, file=%s, ext=%s", notebook_id, filename, ext)

        with open(source_path, "rb") as f:
            data = f.read()
        logger.info("[convert] Read %d bytes from %s", len(data), source_path)

        self._storage.write_source(notebook_id, data, ext)
        logger.info("[convert] Saved source to storage")

        t0 = time.time()
        if ext in ("pdf", "docx", "pptx", "xlsx", "html", "md"):
            result = self._converter.convert_file(source_path)
        else:
            result = self._converter.convert_bytes(data, filename)
        logger.info("[convert] Conversion done in %.1fs", time.time() - t0)

        self._storage.write_markdown(notebook_id, result.markdown)
        logger.info("[convert] Saved markdown to storage (%d chars)", len(result.markdown))

        now = datetime.now(timezone.utc)
        meta = NotebookMeta(
            notebook_id=notebook_id,
            source_name=filename,
            source_type=ext,
            created_at=now,
            updated_at=now,
        )
        self._storage.write_meta(notebook_id, meta)
        logger.info("[convert] Done: notebook_id=%s", notebook_id)
        return meta

    def convert_bytes(self, data: bytes, filename: str, notebook_id: str | None = None) -> NotebookMeta:
        if notebook_id is None:
            notebook_id = uuid.uuid4().hex[:12]

        ext = filename.rsplit(".", 1)[-1].lower()
        logger.info("[convert_bytes] notebook_id=%s, file=%s, ext=%s, size=%d", notebook_id, filename, ext, len(data))
        self._storage.write_source(notebook_id, data, ext)
        logger.info("[convert_bytes] Saved source to storage")

        t0 = time.time()
        result = self._converter.convert_bytes(data, filename)
        logger.info("[convert_bytes] Conversion done in %.1fs", time.time() - t0)

        self._storage.write_markdown(notebook_id, result.markdown)
        logger.info("[convert_bytes] Saved markdown to storage (%d chars)", len(result.markdown))

        now = datetime.now(timezone.utc)
        meta = NotebookMeta(
            notebook_id=notebook_id,
            source_name=filename,
            source_type=ext,
            created_at=now,
            updated_at=now,
        )
        self._storage.write_meta(notebook_id, meta)
        logger.info("[convert_bytes] Done: notebook_id=%s", notebook_id)
        return meta

    def convert_and_embed(
        self,
        source_path: str,
        notebook_id: str | None = None,
        *,
        model: str | None = None,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        chunk_strategy: str | None = None,
    ) -> tuple[NotebookMeta, EmbeddingVersion]:
        """
        Convert, chunk, and embed a file in one atomic operation.
        If any step fails, all changes are rolled back.
        """
        if notebook_id is None:
            notebook_id = uuid.uuid4().hex[:12]

        filename = os.path.basename(source_path)
        ext = filename.rsplit(".", 1)[-1].lower()

        embed_model = model or self._embedder.model
        cs = chunk_size or int(os.getenv("DEFAULT_CHUNK_SIZE", "512"))
        co = chunk_overlap or int(os.getenv("DEFAULT_CHUNK_OVERLAP", "64"))
        strategy = chunk_strategy or "docling"

        version_id = uuid.uuid4().hex[:8]
        lance_path = os.path.join(self._lance_db_uri, notebook_id, version_id)

        logger.info(
            "[convert_and_embed] start: notebook_id=%s, file=%s, ext=%s, "
            "model=%s, chunk_size=%d, chunk_overlap=%d, strategy=%s, version_id=%s",
            notebook_id, filename, ext, embed_model, cs, co, strategy, version_id,
        )
        t_total = time.time()

        try:
            with open(source_path, "rb") as f:
                data = f.read()
            logger.info("[convert_and_embed] Read %d bytes from %s", len(data), source_path)

            self._storage.write_source(notebook_id, data, ext)
            logger.info("[convert_and_embed] Saved source to storage")

            t0 = time.time()
            if ext in ("pdf", "docx", "pptx", "xlsx", "html", "md"):
                result = self._converter.convert_file(source_path)
            else:
                result = self._converter.convert_bytes(data, filename)
            logger.info("[convert_and_embed] Conversion done in %.1fs", time.time() - t0)

            self._storage.write_markdown(notebook_id, result.markdown)
            logger.info("[convert_and_embed] Saved markdown (%d chars)", len(result.markdown))

            if result.docling_doc is not None:
                self._storage.write_docling_doc(notebook_id, result.docling_doc)
                logger.info("[convert_and_embed] Saved docling document")

            t0 = time.time()
            if strategy == "docling":
                if result.docling_doc is None:
                    raise EmbeddingError(
                        f"Failed to generate docling document for {filename}. "
                        "This file format may not be supported by docling."
                    )
                chunks = chunk_by_docling(
                    result.docling_doc, notebook_id, version_id, max_tokens=cs,
                )
            else:
                chunks = chunk(
                    result.markdown, notebook_id, version_id,
                    strategy=strategy, chunk_size=cs, chunk_overlap=co,
                )
            logger.info("[convert_and_embed] Chunking done in %.1fs, %d chunks", time.time() - t0, len(chunks))

            if not chunks:
                raise EmbeddingError(f"No chunks generated for notebook {notebook_id}")

            t0 = time.time()
            texts = [c.content for c in chunks]
            embeddings = self._embedder.embed_texts(texts)
            logger.info(
                "[convert_and_embed] Embedding done in %.1fs, %d vectors, dim=%d",
                time.time() - t0, len(embeddings), len(embeddings[0]),
            )

            for c, emb in zip(chunks, embeddings):
                c.embedding = emb

            t0 = time.time()
            vs = VectorStore(lance_path, storage_options=self._lance_storage_options)
            vs.create_table("vectors", chunks)
            logger.info("[convert_and_embed] Vector store created in %.1fs", time.time() - t0)

            now = datetime.now(timezone.utc)
            version_config = EmbeddingVersion(
                version_id=version_id,
                model=embed_model,
                chunk_size=cs,
                chunk_overlap=co,
                chunk_strategy=strategy,
                created_at=now,
                chunk_count=len(chunks),
                dimension=len(embeddings[0]),
            )

            self._storage.write_versions(notebook_id, [version_config])
            self._storage.write_version_config(notebook_id, version_id, version_config)

            meta = NotebookMeta(
                notebook_id=notebook_id,
                source_name=filename,
                source_type=ext,
                created_at=now,
                updated_at=now,
            )
            self._storage.write_meta(notebook_id, meta)

            logger.info(
                "[convert_and_embed] Done in %.1fs total: notebook_id=%s, version=%s, chunks=%d",
                time.time() - t_total, notebook_id, version_id, len(chunks),
            )
            return meta, version_config

        except Exception as e:
            logger.error("[convert_and_embed] Failed, rolling back: %s", e)
            if os.path.exists(lance_path):
                shutil.rmtree(lance_path, ignore_errors=True)
            self._storage.delete_notebook(notebook_id)
            raise EmbeddingError(f"Operation failed, all changes rolled back: {e}") from e

    def embed(
        self,
        notebook_id: str,
        *,
        model: str | None = None,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        chunk_strategy: str | None = None,
    ) -> EmbeddingVersion:
        embed_model = model or self._embedder.model
        cs = chunk_size or int(os.getenv("DEFAULT_CHUNK_SIZE", "512"))
        co = chunk_overlap or int(os.getenv("DEFAULT_CHUNK_OVERLAP", "64"))
        strategy = chunk_strategy or "docling"

        version_id = uuid.uuid4().hex[:8]
        logger.info(
            "[embed] start: notebook_id=%s, model=%s, chunk_size=%d, chunk_overlap=%d, strategy=%s, version_id=%s",
            notebook_id, embed_model, cs, co, strategy, version_id,
        )
        t_total = time.time()

        if strategy == "docling":
            docling_doc = self._storage.read_docling_doc(notebook_id)
            if docling_doc is None:
                raise ValueError(
                    f"No docling document found for notebook {notebook_id}. "
                    "Please re-convert the notebook with docling enabled."
                )
            chunks = chunk_by_docling(
                docling_doc, notebook_id, version_id, max_tokens=cs,
            )
        else:
            markdown = self._storage.read_markdown(notebook_id)
            chunks = chunk(
                markdown, notebook_id, version_id,
                strategy=strategy, chunk_size=cs, chunk_overlap=co,
            )
        logger.info("[embed] Chunking done, %d chunks", len(chunks))

        if not chunks:
            raise ValueError(f"No chunks generated for notebook {notebook_id}")

        t0 = time.time()
        texts = [c.content for c in chunks]
        embeddings = self._embedder.embed_texts(texts)
        logger.info(
            "[embed] Embedding done in %.1fs, %d vectors, dim=%d",
            time.time() - t0, len(embeddings), len(embeddings[0]),
        )

        for c, emb in zip(chunks, embeddings):
            c.embedding = emb

        lance_path = os.path.join(self._lance_db_uri, notebook_id, version_id)
        vs = VectorStore(lance_path, storage_options=self._lance_storage_options)
        vs.create_table("vectors", chunks)
        logger.info("[embed] Vector store created")

        now = datetime.now(timezone.utc)
        version_config = EmbeddingVersion(
            version_id=version_id,
            model=embed_model,
            chunk_size=cs,
            chunk_overlap=co,
            chunk_strategy=strategy,
            created_at=now,
            chunk_count=len(chunks),
            dimension=len(embeddings[0]),
        )

        versions = []
        try:
            versions = self._storage.read_versions(notebook_id)
        except Exception:
            pass
        versions.append(version_config)
        self._storage.write_versions(notebook_id, versions)
        self._storage.write_version_config(notebook_id, version_id, version_config)

        logger.info("[embed] Done in %.1fs total: version=%s, chunks=%d", time.time() - t_total, version_id, len(chunks))
        return version_config

    def query(
        self,
        notebook_id: str,
        query: str,
        *,
        version_id: str | None = None,
        top_k: int = 5,
    ) -> list[ChunkResult]:
        if version_id is None:
            try:
                versions = self._storage.read_versions(notebook_id)
            except Exception:
                raise ValueError(f"Notebook {notebook_id} not found")
            if not versions:
                raise ValueError(f"No embedding versions for notebook {notebook_id}")
            version_id = versions[-1].version_id

        lance_path = os.path.join(self._lance_db_uri, notebook_id, version_id)
        vs = VectorStore(lance_path, storage_options=self._lance_storage_options)
        retriever = Retriever(self._embedder, vs)
        return retriever.retrieve("vectors", query, top_k)

    def list_notebooks(self) -> list[NotebookMeta]:
        nb_ids = self._storage.list_notebooks()
        result = []
        for nb_id in nb_ids:
            try:
                result.append(self._storage.read_meta(nb_id))
            except Exception:
                logger.warning("Skipping notebook %s: meta.json not found", nb_id)
        return result

    def list_versions(self, notebook_id: str) -> list[EmbeddingVersion]:
        return self._storage.read_versions(notebook_id)

    def delete_notebook(self, notebook_id: str) -> None:
        self._storage.delete_notebook(notebook_id)

    def delete_version(self, notebook_id: str, version_id: str) -> None:
        self._storage.delete_version(notebook_id, version_id)
        versions = []
        try:
            versions = self._storage.read_versions(notebook_id)
        except Exception:
            pass
        versions = [v for v in versions if v.version_id != version_id]
        if versions:
            self._storage.write_versions(notebook_id, versions)

    # ── RAG Q&A ──────────────────────────────────────────────────────────

    SYSTEM_PROMPT = """\
你是一个专业的医学教育辅助助手。请根据下面提供的参考资料来回答用户的问题。

要求：
1. 优先使用参考资料中的内容回答，如果参考资料不足以回答问题，可以结合你的医学知识补充，但需要明确说明。
2. 引用资料时使用 [ref:1], [ref:2] 等标注，对应参考资料的序号。
3. 回答要准确、有条理，适当使用 Markdown 格式。
4. 如果涉及医学数据或统计信息，请务必核实来源。
"""

    def _retrieve_context(
        self,
        notebook_id: str,
        query: str,
        version_id: str | None = None,
        top_k: int = 5,
    ) -> list[ChunkResult]:
        """Retrieve relevant chunks for a query."""
        if version_id is None:
            versions = self._storage.read_versions(notebook_id)
            if not versions:
                raise ValueError(f"No embedding versions for notebook {notebook_id}")
            version_id = versions[-1].version_id

        lance_path = os.path.join(self._lance_db_uri, notebook_id, version_id)
        vs = VectorStore(lance_path, storage_options=self._lance_storage_options)
        retriever = Retriever(self._embedder, vs)
        return retriever.retrieve("vectors", query, top_k)

    def _build_context(self, chunks: list[ChunkResult]) -> str:
        """Build context string from retrieved chunks."""
        parts: list[str] = []
        for i, chunk in enumerate(chunks, 1):
            heading = " > ".join(chunk.heading_path) if chunk.heading_path else ""
            header = f"--- 参考资料 [{i}]"
            if heading:
                header += f" {heading}"
            if chunk.page_number is not None:
                header += f" (第{chunk.page_number}页)"
            parts.append(f"{header} ---\n{chunk.content}")
        return "\n\n".join(parts)

    async def chat_stream(
        self,
        notebook_id: str,
        query: str,
        history: list[ChatMessage] | None = None,
        version_id: str | None = None,
        top_k: int = 5,
        model: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        RAG Q&A with streaming: retrieve chunks, build prompt, stream LLM response.
        Yields NDJSON lines (AgentMessage format compatible with quiz-ui chat).
        """
        import json

        def ndjson(**kwargs: object) -> str:
            return json.dumps(kwargs, ensure_ascii=False)

        history = history or []

        # 1. Retrieve relevant chunks
        yield ndjson(type="step", content="正在检索相关资料...")
        try:
            chunks = self._retrieve_context(notebook_id, query, version_id, top_k)
        except Exception as e:
            yield ndjson(type="error", content=f"检索失败: {e}")
            return

        if not chunks:
            yield ndjson(type="step", content="未找到相关参考资料，将直接回答问题")

        # 2. Send references
        references = [
            {
                "title": " > ".join(c.heading_path) if c.heading_path else "未命名章节",
                "score": c.score,
                "content": c.content,
                "presigned_url": "",
                "page_number": str(c.page_number) if c.page_number else None,
            }
            for c in chunks
        ]
        if references:
            yield ndjson(type="references", content="", references=references)

        # 3. Build prompt with context
        context = self._build_context(chunks)
        context_block = f"<参考资料>\n{context}\n</参考资料>" if context else ""

        messages: list[dict[str, str]] = [
            {"role": "system", "content": self.SYSTEM_PROMPT + "\n\n" + context_block},
        ]

        # Add history
        for msg in history[-10:]:  # keep last 10 messages for context window
            messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": query})

        # 4. Stream LLM response
        yield ndjson(type="step", content="正在生成回答...")

        llm_model = model or os.getenv("DEFAULT_CHAT_MODEL", "qwen-plus")
        client = OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL"),
        )

        try:
            stream = client.chat.completions.create(
                model=llm_model,
                messages=messages,
                stream=True,
            )
            for chunk_resp in stream:
                delta = chunk_resp.choices[0].delta if chunk_resp.choices else None
                if delta and delta.content:
                    yield ndjson(type="update", content=delta.content)

            yield ndjson(type="done", content="", references=references)

        except Exception as e:
            logger.error("[chat_stream] LLM error: %s", e)
            yield ndjson(type="error", content=f"生成回答失败: {e}")
