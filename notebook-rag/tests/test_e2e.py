import io
import shutil
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def e2e_env(tmp_path):
    lance_dir = tmp_path / "lance"
    lance_dir.mkdir()
    nb_dir = tmp_path / "notebooks"
    nb_dir.mkdir()

    with (
        patch("server.get_service") as mock_get_svc,
        patch("cli._get_service") as mock_cli_get_svc,
    ):
        from lib.embedder import Embedder
        from lib.service import NotebookService
        from lib.storage import Storage

        storage = Storage(scheme="fs", root=str(nb_dir))

        mock_embedder = MagicMock(spec=Embedder)
        mock_embedder.model = "test-embedding"
        mock_embedder.embed_query.return_value = [0.1, 0.2, 0.3]
        mock_embedder.embed_texts.return_value = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]

        svc = NotebookService(storage, embedder=mock_embedder, lance_db_uri=str(lance_dir))
        mock_get_svc.return_value = svc
        mock_cli_get_svc.return_value = svc

        from server import app
        client = TestClient(app)
        yield client, svc

        shutil.rmtree(str(lance_dir), ignore_errors=True)
        shutil.rmtree(str(nb_dir), ignore_errors=True)


class TestE2EFullFlow:
    def test_convert_embed_query_flow(self, e2e_env):
        client, svc = e2e_env

        resp = client.post(
            "/notebooks/convert",
            files={"file": ("test.md", io.BytesIO(b"# Hello\n\nWorld content"), "text/markdown")},
        )
        assert resp.status_code == 201
        nb_id = resp.json()["notebook_id"]
        assert nb_id is not None

        resp = client.post("/notebooks/embed", json={
            "notebook_id": nb_id,
            "chunk_strategy": "heading",
        })
        assert resp.status_code == 201
        version_id = resp.json()["version_id"]

        resp = client.post("/notebooks/query", json={
            "notebook_id": nb_id,
            "query": "hello",
        })
        assert resp.status_code == 200
        chunks = resp.json()["chunks"]
        assert len(chunks) >= 1

    def test_list_notebooks_after_convert(self, e2e_env):
        client, svc = e2e_env

        resp = client.get("/notebooks")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

        client.post(
            "/notebooks/convert",
            files={"file": ("a.md", io.BytesIO(b"# A\n\nContent A"), "text/markdown")},
        )
        client.post(
            "/notebooks/convert",
            files={"file": ("b.md", io.BytesIO(b"# B\n\nContent B"), "text/markdown")},
        )

        resp = client.get("/notebooks")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_versions_after_embed(self, e2e_env):
        client, svc = e2e_env

        resp = client.post(
            "/notebooks/convert",
            files={"file": ("t.md", io.BytesIO(b"# T\n\nSome content"), "text/markdown")},
        )
        nb_id = resp.json()["notebook_id"]

        resp = client.post("/notebooks/embed", json={"notebook_id": nb_id})
        assert resp.status_code == 201

        resp = client.post("/notebooks/embed", json={
            "notebook_id": nb_id,
            "chunk_strategy": "fixed",
        })
        assert resp.status_code == 201

        resp = client.get(f"/notebooks/{nb_id}/versions")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_delete_notebook(self, e2e_env):
        client, svc = e2e_env

        resp = client.post(
            "/notebooks/convert",
            files={"file": ("del.md", io.BytesIO(b"# Del\n\nTo delete"), "text/markdown")},
        )
        nb_id = resp.json()["notebook_id"]

        resp = client.delete(f"/notebooks/{nb_id}")
        assert resp.status_code == 200

        resp = client.get("/notebooks")
        assert len(resp.json()) == 0

    def test_delete_version(self, e2e_env):
        client, svc = e2e_env

        resp = client.post(
            "/notebooks/convert",
            files={"file": ("dv.md", io.BytesIO(b"# DV\n\nContent"), "text/markdown")},
        )
        nb_id = resp.json()["notebook_id"]

        resp = client.post("/notebooks/embed", json={"notebook_id": nb_id})
        v1 = resp.json()["version_id"]

        resp = client.post("/notebooks/embed", json={"notebook_id": nb_id})
        v2 = resp.json()["version_id"]

        resp = client.delete(f"/notebooks/{nb_id}/versions/{v1}")
        assert resp.status_code == 200

        resp = client.get(f"/notebooks/{nb_id}/versions")
        versions = resp.json()
        assert len(versions) == 1
        assert versions[0]["version_id"] == v2

    def test_query_nonexistent_notebook(self, e2e_env):
        client, svc = e2e_env
        resp = client.post("/notebooks/query", json={
            "notebook_id": "nonexistent",
            "query": "test",
        })
        assert resp.status_code == 400

    def test_query_specific_version(self, e2e_env):
        client, svc = e2e_env

        resp = client.post(
            "/notebooks/convert",
            files={"file": ("sv.md", io.BytesIO(b"# SV\n\nContent for version test"), "text/markdown")},
        )
        nb_id = resp.json()["notebook_id"]

        resp = client.post("/notebooks/embed", json={"notebook_id": nb_id})
        v1 = resp.json()["version_id"]

        resp = client.post("/notebooks/embed", json={"notebook_id": nb_id, "chunk_strategy": "fixed"})
        assert resp.status_code == 201

        resp = client.post("/notebooks/query", json={
            "notebook_id": nb_id,
            "query": "test",
            "version_id": v1,
        })
        assert resp.status_code == 200
