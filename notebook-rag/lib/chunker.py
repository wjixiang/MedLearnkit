import hashlib
import re
import uuid

from lib.models import Chunk


def _chunk_id() -> str:
    return uuid.uuid4().hex[:12]


def chunk_by_heading(
    markdown: str,
    notebook_id: str,
    version_id: str,
    max_chunk_size: int = 2000,
) -> list[Chunk]:
    lines = markdown.split("\n")
    chunks: list[Chunk] = []
    current_heading_path: list[str] = []
    current_content_lines: list[str] = []

    heading_re = re.compile(r"^(#{1,6})\s+(.+)$")

    def flush():
        nonlocal current_content_lines
        content = "\n".join(current_content_lines).strip()
        if content:
            chunks.append(
                Chunk(
                    chunk_id=_chunk_id(),
                    notebook_id=notebook_id,
                    version_id=version_id,
                    content=content,
                    heading_path=list(current_heading_path),
                )
            )
        current_content_lines = []

    for line in lines:
        m = heading_re.match(line)
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            while len(current_heading_path) >= level:
                current_heading_path.pop()
            current_heading_path.append(title)
            flush()
        else:
            current_content_lines.append(line)
            total = "\n".join(current_content_lines)
            if len(total) >= max_chunk_size:
                flush()

    flush()
    return chunks


def chunk_by_fixed(
    markdown: str,
    notebook_id: str,
    version_id: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[Chunk]:
    chunks: list[Chunk] = []
    text = markdown
    start = 0
    while start < len(text):
        end = start + chunk_size
        content = text[start:end].strip()
        if content:
            chunks.append(
                Chunk(
                    chunk_id=_chunk_id(),
                    notebook_id=notebook_id,
                    version_id=version_id,
                    content=content,
                    heading_path=[],
                )
            )
        if end >= len(text):
            break
        start = end - chunk_overlap
        if start <= start - chunk_size + chunk_overlap and chunk_overlap == 0:
            start = end
    return chunks


def chunk_by_docling(
    docling_doc,
    notebook_id: str,
    version_id: str,
    max_tokens: int = 512,
) -> list[Chunk]:
    from docling.chunking import HybridChunker

    chunker = HybridChunker(max_tokens=max_tokens)
    chunks: list[Chunk] = []

    for doc_chunk in chunker.chunk(dl_doc=docling_doc):
        heading_path = []
        meta = getattr(doc_chunk, "meta", None)
        if meta is not None:
            headings = getattr(meta, "headings", None) or []
            heading_path = [getattr(h, "text", str(h)) for h in headings]

        content = chunker.contextualize(chunk=doc_chunk)
        if not content.strip():
            continue

        chunks.append(
            Chunk(
                chunk_id=_chunk_id(),
                notebook_id=notebook_id,
                version_id=version_id,
                content=content,
                heading_path=heading_path,
            )
        )

    return chunks


def chunk(
    markdown: str,
    notebook_id: str,
    version_id: str,
    strategy: str = "heading",
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[Chunk]:
    if strategy == "heading":
        return chunk_by_heading(markdown, notebook_id, version_id, max_chunk_size=chunk_size * 4)
    elif strategy == "fixed":
        return chunk_by_fixed(markdown, notebook_id, version_id, chunk_size, chunk_overlap)
    elif strategy == "docling":
        raise ValueError(
            "docling strategy requires a DoclingDocument; use chunk_by_docling() directly"
        )
    else:
        raise ValueError(f"Unknown chunk strategy: {strategy}")
