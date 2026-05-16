"""
End-to-end test for the RAG Q&A pipeline.

Creates a temporary notebook with embedded chunks, then verifies:
1. The /chat endpoint returns a streaming NDJSON response
2. The response contains step/update/done messages
3. The LLM-generated content is non-empty
4. References from retrieval are included
"""
import json
import os
import tempfile
import time
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from lib.models import Chunk, ChunkResult, EmbeddingVersion, NotebookMeta
from lib.service import NotebookService


@pytest.fixture
def embedded_notebook(tmp_path):
    """Create a service with a real embedded notebook for e2e testing."""
    # Use local filesystem for storage and LanceDB
    with (
        patch("lib.service.Storage") as mock_storage_cls,
    ):
        mock_storage = MagicMock()
        mock_storage_cls.return_value = mock_storage
        mock_storage_cls.from_env.return_value = mock_storage

        # Setup notebook metadata
        notebook_id = uuid.uuid4().hex[:12]
        version_id = uuid.uuid4().hex[:8]
        meta = NotebookMeta(
            notebook_id=notebook_id,
            source_name="外科学_第十版.pdf",
            source_type="pdf",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_storage.read_meta.return_value = meta
        mock_storage.read_versions.return_value = [
            EmbeddingVersion(
                version_id=version_id,
                model="text-embedding-v4",
                chunk_size=512,
                chunk_overlap=64,
                chunk_strategy="heading",
                created_at=datetime.now(timezone.utc),
                chunk_count=3,
                dimension=1024,
            )
        ]

        # Create actual LanceDB with mock embeddings
        lance_path = str(tmp_path / "lance" / notebook_id / version_id)
        os.makedirs(lance_path, exist_ok=True)

        # Create mock chunks with embeddings
        dim = 8
        chunks = [
            Chunk(
                chunk_id=uuid.uuid4().hex[:12],
                notebook_id=notebook_id,
                version_id=version_id,
                content="休克是机体有效循环血容量减少、组织灌注不足，细胞代谢紊乱和功能受损的病理过程。",
                heading_path=["第四章", "休克"],
                page_number=56,
                embedding=[0.1] * dim,
            ),
            Chunk(
                chunk_id=uuid.uuid4().hex[:12],
                notebook_id=notebook_id,
                version_id=version_id,
                content="休克分为低血容量性休克、感染性休克、心源性休克、神经源性休克和过敏性休克。",
                heading_path=["第四章", "休克的分类"],
                page_number=57,
                embedding=[0.2] * dim,
            ),
            Chunk(
                chunk_id=uuid.uuid4().hex[:12],
                notebook_id=notebook_id,
                version_id=version_id,
                content="休克的治疗原则：尽早去除引起休克的原因，尽快恢复有效循环血量，改善微循环。",
                heading_path=["第四章", "休克的治疗"],
                page_number=58,
                embedding=[0.3] * dim,
            ),
        ]

        # Create a real LanceDB table
        from lib.vector_store import VectorStore

        vs = VectorStore(lance_path)
        vs.create_table("vectors", chunks)

        # Mock embedder to return fixed vectors for queries
        mock_embedder = MagicMock()
        mock_embedder.embed_query.return_value = [0.1] * dim

        svc = NotebookService(
            mock_storage,
            embedder=mock_embedder,
            lance_db_uri=str(tmp_path / "lance"),
        )

        yield svc, notebook_id, version_id


class TestRAGEndToEnd:
    def test_chat_endpoint_streams_response(self, embedded_notebook):
        """Test the full /chat endpoint returns streaming NDJSON."""
        svc, notebook_id, _ = embedded_notebook

        # Patch the service in server.py
        with patch("server.get_service", return_value=svc):
            from server import app

            client = TestClient(app)

            # Mock the OpenAI client to avoid real API calls
            mock_stream_chunks = [
                MagicMock(choices=[MagicMock(delta=MagicMock(content="休克是"))]),
                MagicMock(choices=[MagicMock(delta=MagicMock(content="一种"))]),
                MagicMock(choices=[MagicMock(delta=MagicMock(content="病理过程。"))]),
            ]
            mock_completion = MagicMock()
            mock_completion.__iter__ = lambda self: iter(mock_stream_chunks)

            with patch("lib.service.OpenAI") as mock_openai_cls:
                mock_client = MagicMock()
                mock_client.chat.completions.create.return_value = mock_stream_chunks
                mock_openai_cls.return_value = mock_client

                response = client.post(
                    "/chat",
                    json={
                        "notebook_id": notebook_id,
                        "query": "什么是休克?",
                        "top_k": 3,
                    },
                )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        lines = [
            json.loads(line)
            for line in response.text.strip().split("\n")
            if line.strip()
        ]
        types = [l["type"] for l in lines]

        # Should have step messages for retrieval progress
        assert "step" in types, f"Expected 'step' in {types}"

        # Should have references from retrieval
        ref_msg = next((l for l in lines if l["type"] == "references"), None)
        assert ref_msg is not None, "Expected references message"
        assert len(ref_msg["references"]) == 3

        # Should have content updates
        assert "update" in types, f"Expected 'update' in {types}"

        # Should have done message
        assert "done" in types, f"Expected 'done' in {types}"

        # Verify content was accumulated
        content_parts = [l["content"] for l in lines if l["type"] == "update"]
        full_content = "".join(content_parts)
        assert len(full_content) > 0

    def test_chat_with_history(self, embedded_notebook):
        """Test that history messages are passed through."""
        svc, notebook_id, _ = embedded_notebook

        with patch("server.get_service", return_value=svc):
            from server import app

            client = TestClient(app)

            mock_stream_chunks = [
                MagicMock(choices=[MagicMock(delta=MagicMock(content="继续回答"))]),
            ]

            with patch("lib.service.OpenAI") as mock_openai_cls:
                mock_client = MagicMock()
                mock_client.chat.completions.create.return_value = mock_stream_chunks
                mock_openai_cls.return_value = mock_client

                response = client.post(
                    "/chat",
                    json={
                        "notebook_id": notebook_id,
                        "query": "详细说一下",
                        "history": [
                            {"role": "user", "content": "什么是休克?"},
                            {"role": "assistant", "content": "休克是..."},
                        ],
                    },
                )

        assert response.status_code == 200

        # Verify the LLM was called with history messages
        call_args = mock_client.chat.completions.create.call_args
        messages = call_args.kwargs.get("messages", call_args[1].get("messages", []))
        user_msgs = [m for m in messages if m["role"] == "user"]
        assert len(user_msgs) >= 2  # history user + current query

    def test_chat_notebook_not_found(self):
        """Test error when notebook doesn't exist - returns error in stream."""
        mock_svc = MagicMock()
        mock_svc.chat_stream.side_effect = ValueError("Notebook not-found not found")

        with patch("server.get_service", return_value=mock_svc):
            from server import app

            client = TestClient(app)

            response = client.post(
                "/chat",
                json={
                    "notebook_id": "not-found",
                    "query": "test",
                },
            )

        # Server returns 200 with streaming, but error is in the stream
        assert response.status_code == 200
        lines = [
            json.loads(line)
            for line in response.text.strip().split("\n")
            if line.strip()
        ]
        error_msgs = [l for l in lines if l["type"] == "error"]
        assert len(error_msgs) == 1
        assert "not-found" in error_msgs[0]["content"]

    def test_retrieval_quality(self, embedded_notebook):
        """Test that retrieval returns relevant chunks with scores."""
        svc, notebook_id, version_id = embedded_notebook

        results = svc.query(notebook_id, "休克的治疗", version_id=version_id, top_k=3)

        assert len(results) > 0
        # All results should have content
        for r in results:
            assert r.content is not None
            assert len(r.content) > 0
            assert r.score >= 0
