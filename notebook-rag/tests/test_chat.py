"""Tests for the /chat RAG Q&A endpoint."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from server import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_service():
    with patch("server.get_service") as mock_get_svc:
        svc = MagicMock()
        mock_get_svc.return_value = svc
        yield svc


class TestChatEndpoint:
    def test_chat_returns_streaming_response(self, client, mock_service):
        """Test that /chat returns a streaming NDJSON response."""
        async def fake_stream(**kwargs):
            yield json.dumps({"type": "step", "content": "检索中..."})
            yield "\n"
            yield json.dumps({"type": "update", "content": "你好"})
            yield "\n"
            yield json.dumps({"type": "done", "content": "", "references": []})
            yield "\n"

        mock_service.chat_stream = fake_stream

        response = client.post(
            "/chat",
            json={
                "notebook_id": "test-nb",
                "query": "什么是休克?",
            },
            headers={"Accept": "text/event-stream"},
        )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        lines = [
            json.loads(line)
            for line in response.text.strip().split("\n")
            if line.strip()
        ]

        types = [l["type"] for l in lines]
        assert "step" in types
        assert "update" in types
        assert "done" in types

    def test_chat_with_history(self, client, mock_service):
        """Test that chat accepts history messages."""
        async def fake_stream(**kwargs):
            yield json.dumps({"type": "done", "content": "", "references": []})
            yield "\n"

        mock_service.chat_stream = fake_stream

        response = client.post(
            "/chat",
            json={
                "notebook_id": "test-nb",
                "query": "继续",
                "history": [
                    {"role": "user", "content": "什么是休克?"},
                    {"role": "assistant", "content": "休克是..."},
                ],
            },
        )

        assert response.status_code == 200

    def test_chat_invalid_request(self, client, mock_service):
        """Test that missing required fields returns 422."""
        response = client.post("/chat", json={})
        assert response.status_code == 422


class TestChatBuildContext:
    """Test the context building logic in NotebookService."""

    def test_build_context(self):
        from lib.models import ChunkResult
        from lib.service import NotebookService

        svc = NotebookService(MagicMock())
        chunks = [
            ChunkResult(
                chunk_id="c1",
                content="Content 1",
                heading_path=["Chapter 1", "Section 1.1"],
                score=0.9,
                page_number=42,
            ),
            ChunkResult(
                chunk_id="c2",
                content="Content 2",
                heading_path=[],
                score=0.8,
            ),
        ]
        context = svc._build_context(chunks)

        assert "[1]" in context
        assert "Chapter 1 > Section 1.1" in context
        assert "第42页" in context
        assert "Content 1" in context
        assert "[2]" in context
        assert "Content 2" in context
