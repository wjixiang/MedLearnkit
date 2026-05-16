import os
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from lib.models import EmbeddingVersion, NotebookMeta
from lib.service import NotebookService


@pytest.fixture
def mock_components():
    with (
        patch("lib.service.Storage") as mock_storage_cls,
        patch("lib.service.Converter") as mock_converter_cls,
        patch("lib.service.Embedder") as mock_embedder_cls,
    ):
        mock_storage = MagicMock()
        mock_storage_cls.return_value = mock_storage

        mock_converter = MagicMock()
        mock_converter_cls.return_value = mock_converter

        mock_embedder = MagicMock()
        mock_embedder.model = "test-model"
        mock_embedder_cls.return_value = mock_embedder

        yield mock_storage, mock_converter, mock_embedder


class TestNotebookServiceConvert:
    def test_convert_file(self, mock_components, tmp_path):
        mock_storage, mock_converter, mock_embedder = mock_components
        source = tmp_path / "test.pdf"
        source.write_bytes(b"fake-pdf")

        mock_converter.convert_file.return_value = MagicMock(
            markdown="# Test\n\nContent", image_refs=[]
        )

        svc = NotebookService(mock_storage)
        meta = svc.convert(str(source))

        assert isinstance(meta, NotebookMeta)
        assert meta.source_type == "pdf"
        assert meta.notebook_id is not None
        mock_storage.write_source.assert_called_once()
        mock_storage.write_markdown.assert_called_once()
        mock_storage.write_meta.assert_called_once()

    def test_convert_with_custom_id(self, mock_components, tmp_path):
        mock_storage, mock_converter, mock_embedder = mock_components
        source = tmp_path / "doc.docx"
        source.write_bytes(b"fake-docx")

        mock_converter.convert_file.return_value = MagicMock(
            markdown="# Doc", image_refs=[]
        )

        svc = NotebookService(mock_storage)
        meta = svc.convert(str(source), notebook_id="my-custom-id")
        assert meta.notebook_id == "my-custom-id"

    def test_convert_bytes(self, mock_components):
        mock_storage, mock_converter, mock_embedder = mock_components
        mock_converter.convert_bytes.return_value = MagicMock(
            markdown="# Bytes", image_refs=[]
        )

        svc = NotebookService(mock_storage)
        meta = svc.convert_bytes(b"data", "test.pdf")
        assert isinstance(meta, NotebookMeta)
        mock_storage.write_source.assert_called_once()
        mock_storage.write_markdown.assert_called_once()


class TestNotebookServiceEmbed:
    def test_embed(self, mock_components):
        mock_storage, mock_converter, mock_embedder = mock_components
        mock_storage.read_markdown.return_value = "# Chapter 1\n\nSome content here."
        mock_storage.read_versions.return_value = []
        mock_embedder.embed_texts.return_value = [[0.1, 0.2, 0.3]]

        with patch("lib.service.VectorStore") as mock_vs_cls:
            mock_vs = MagicMock()
            mock_vs_cls.return_value = mock_vs

            svc = NotebookService(mock_storage)
            version = svc.embed("nb-001")

        assert isinstance(version, EmbeddingVersion)
        assert version.version_id is not None
        assert version.model == "test-model"
        assert version.chunk_count > 0
        mock_embedder.embed_texts.assert_called_once()
        mock_storage.write_versions.assert_called_once()
        mock_storage.write_version_config.assert_called_once()

    def test_embed_custom_params(self, mock_components):
        mock_storage, mock_converter, mock_embedder = mock_components
        mock_storage.read_markdown.return_value = "# H\n\nContent"
        mock_storage.read_versions.return_value = []
        mock_embedder.embed_texts.return_value = [[0.1, 0.2, 0.3]]

        with patch("lib.service.VectorStore") as mock_vs_cls:
            mock_vs = MagicMock()
            mock_vs_cls.return_value = mock_vs

            svc = NotebookService(mock_storage)
            version = svc.embed(
                "nb-001",
                model="custom-model",
                chunk_size=256,
                chunk_overlap=32,
                chunk_strategy="fixed",
            )

        assert version.model == "custom-model"
        assert version.chunk_size == 256
        assert version.chunk_overlap == 32
        assert version.chunk_strategy == "fixed"

    def test_embed_empty_markdown_raises(self, mock_components):
        mock_storage, mock_converter, mock_embedder = mock_components
        mock_storage.read_markdown.return_value = ""

        svc = NotebookService(mock_storage)
        with pytest.raises(ValueError, match="No chunks"):
            svc.embed("nb-001")


class TestNotebookServiceQuery:
    def test_query_latest_version(self, mock_components):
        mock_storage, mock_converter, mock_embedder = mock_components
        mock_embedder.embed_query.return_value = [0.1, 0.2]
        mock_storage.read_versions.return_value = [
            EmbeddingVersion(
                version_id="v1", model="m", chunk_size=512, chunk_overlap=64,
                chunk_strategy="heading", created_at=datetime.now(timezone.utc),
                chunk_count=5, dimension=2,
            )
        ]

        with patch("lib.service.VectorStore") as mock_vs_cls:
            mock_vs = MagicMock()
            mock_vs.search.return_value = []
            mock_vs_cls.return_value = mock_vs

            svc = NotebookService(mock_storage)
            results = svc.query("nb-001", "test query")

        assert results == []
        mock_embedder.embed_query.assert_called_once_with("test query")

    def test_query_specific_version(self, mock_components):
        mock_storage, mock_converter, mock_embedder = mock_components
        mock_embedder.embed_query.return_value = [0.1, 0.2]
        mock_storage.read_versions.return_value = []

        with patch("lib.service.VectorStore") as mock_vs_cls:
            mock_vs = MagicMock()
            mock_vs.search.return_value = []
            mock_vs_cls.return_value = mock_vs

            svc = NotebookService(mock_storage)
            results = svc.query("nb-001", "q", version_id="v2", top_k=10)

        assert results == []

    def test_query_no_versions_raises(self, mock_components):
        mock_storage, mock_converter, mock_embedder = mock_components
        mock_storage.read_versions.return_value = []

        svc = NotebookService(mock_storage)
        with pytest.raises(ValueError, match="No embedding versions"):
            svc.query("nb-001", "q")


class TestNotebookServiceList:
    def test_list_notebooks(self, mock_components):
        mock_storage, _, _ = mock_components
        mock_storage.list_notebooks.return_value = ["nb-001", "nb-002"]
        mock_storage.read_meta.side_effect = [
            NotebookMeta(
                notebook_id="nb-001", source_name="a.pdf", source_type="pdf",
                created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
            ),
            NotebookMeta(
                notebook_id="nb-002", source_name="b.docx", source_type="docx",
                created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
            ),
        ]

        svc = NotebookService(mock_storage)
        result = svc.list_notebooks()
        assert len(result) == 2

    def test_list_versions(self, mock_components):
        mock_storage, _, _ = mock_components
        versions = [
            EmbeddingVersion(
                version_id="v1", model="m", chunk_size=512, chunk_overlap=64,
                chunk_strategy="heading", created_at=datetime.now(timezone.utc),
                chunk_count=10, dimension=1536,
            )
        ]
        mock_storage.read_versions.return_value = versions

        svc = NotebookService(mock_storage)
        result = svc.list_versions("nb-001")
        assert len(result) == 1
        assert result[0].version_id == "v1"


class TestNotebookServiceDelete:
    def test_delete_notebook(self, mock_components):
        mock_storage, _, _ = mock_components
        svc = NotebookService(mock_storage)
        svc.delete_notebook("nb-001")
        mock_storage.delete_notebook.assert_called_once_with("nb-001")

    def test_delete_version(self, mock_components):
        mock_storage, _, _ = mock_components
        v1 = EmbeddingVersion(
            version_id="v1", model="m", chunk_size=512, chunk_overlap=64,
            chunk_strategy="heading", created_at=datetime.now(timezone.utc),
            chunk_count=10, dimension=1536,
        )
        v2 = EmbeddingVersion(
            version_id="v2", model="m", chunk_size=512, chunk_overlap=64,
            chunk_strategy="heading", created_at=datetime.now(timezone.utc),
            chunk_count=5, dimension=1536,
        )
        mock_storage.read_versions.return_value = [v1, v2]

        svc = NotebookService(mock_storage)
        svc.delete_version("nb-001", "v1")

        mock_storage.delete_version.assert_called_once_with("nb-001", "v1")
        written = mock_storage.write_versions.call_args[0][1]
        assert len(written) == 1
        assert written[0].version_id == "v2"
