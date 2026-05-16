import io
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from lib.models import EmbeddingVersion, NotebookMeta


@pytest.fixture
def test_client():
    with (
        patch("server.get_service") as mock_get_svc,
    ):
        mock_svc = MagicMock()
        mock_get_svc.return_value = mock_svc

        from server import app
        client = TestClient(app)
        yield client, mock_svc


class TestAPIConvert:
    def test_convert_file(self, test_client):
        client, mock_svc = test_client
        mock_svc.convert_bytes.return_value = NotebookMeta(
            notebook_id="nb-001", source_name="test.pdf", source_type="pdf",
            created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
        )

        resp = client.post(
            "/notebooks/convert",
            files={"file": ("test.pdf", io.BytesIO(b"fake-pdf"), "application/pdf")},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["notebook_id"] == "nb-001"

    def test_convert_error(self, test_client):
        client, mock_svc = test_client
        mock_svc.convert_bytes.side_effect = Exception("conversion failed")

        resp = client.post(
            "/notebooks/convert",
            files={"file": ("bad.txt", io.BytesIO(b"bad"), "text/plain")},
        )
        assert resp.status_code == 500


class TestAPIEmbed:
    def test_embed(self, test_client):
        client, mock_svc = test_client
        mock_svc.embed.return_value = EmbeddingVersion(
            version_id="v1", model="m", chunk_size=512, chunk_overlap=64,
            chunk_strategy="heading", created_at=datetime.now(timezone.utc),
            chunk_count=10, dimension=1536,
        )

        resp = client.post("/notebooks/embed", json={"notebook_id": "nb-001"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["version_id"] == "v1"

    def test_embed_value_error(self, test_client):
        client, mock_svc = test_client
        mock_svc.embed.side_effect = ValueError("No chunks")

        resp = client.post("/notebooks/embed", json={"notebook_id": "nb-001"})
        assert resp.status_code == 400


class TestAPIQuery:
    def test_query(self, test_client):
        from lib.models import ChunkResult
        client, mock_svc = test_client
        mock_svc.query.return_value = [
            ChunkResult(chunk_id="c1", content="hello", heading_path=["Ch1"], score=0.9),
        ]

        resp = client.post("/notebooks/query", json={
            "notebook_id": "nb-001",
            "query": "test",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["chunks"]) == 1
        assert data["chunks"][0]["chunk_id"] == "c1"

    def test_query_value_error(self, test_client):
        client, mock_svc = test_client
        mock_svc.query.side_effect = ValueError("No versions")

        resp = client.post("/notebooks/query", json={
            "notebook_id": "nb-001",
            "query": "test",
        })
        assert resp.status_code == 400


class TestAPIList:
    def test_list_notebooks(self, test_client):
        client, mock_svc = test_client
        mock_svc.list_notebooks.return_value = [
            NotebookMeta(
                notebook_id="nb-001", source_name="a.pdf", source_type="pdf",
                created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
            ),
        ]

        resp = client.get("/notebooks")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_list_versions(self, test_client):
        client, mock_svc = test_client
        mock_svc.list_versions.return_value = [
            EmbeddingVersion(
                version_id="v1", model="m", chunk_size=512, chunk_overlap=64,
                chunk_strategy="heading", created_at=datetime.now(timezone.utc),
                chunk_count=10, dimension=1536,
            ),
        ]

        resp = client.get("/notebooks/nb-001/versions")
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestAPIDelete:
    def test_delete_notebook(self, test_client):
        client, mock_svc = test_client
        resp = client.delete("/notebooks/nb-001")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_delete_version(self, test_client):
        client, mock_svc = test_client
        resp = client.delete("/notebooks/nb-001/versions/v1")
        assert resp.status_code == 200
