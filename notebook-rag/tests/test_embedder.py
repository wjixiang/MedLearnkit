import os
from unittest.mock import MagicMock, patch

import pytest

from lib.embedder import Embedder


@pytest.fixture
def mock_openai():
    with patch("lib.embedder.OpenAI") as mock_cls:
        mock_client = MagicMock()
        mock_cls.return_value = mock_client
        yield mock_client


class TestEmbedder:
    def test_init_defaults(self, mock_openai):
        emb = Embedder()
        assert emb.model == os.getenv("DEFAULT_EMBEDDING_MODEL", "text-embedding-3-small")

    def test_init_custom_model(self, mock_openai):
        emb = Embedder(model="my-model")
        assert emb.model == "my-model"

    def test_init_custom_api_key_and_base_url(self, mock_openai):
        emb = Embedder(api_key="key-123", base_url="https://example.com/v1")
        assert emb.model == os.getenv("DEFAULT_EMBEDDING_MODEL", "text-embedding-3-small")

    def test_embed_texts(self, mock_openai):
        mock_response = MagicMock()
        mock_response.data = [
            MagicMock(index=0, embedding=[0.1, 0.2]),
            MagicMock(index=1, embedding=[0.3, 0.4]),
        ]
        mock_openai.embeddings.create.return_value = mock_response

        emb = Embedder()
        results = emb.embed_texts(["hello", "world"])
        assert results == [[0.1, 0.2], [0.3, 0.4]]
        mock_openai.embeddings.create.assert_called_once()

    def test_embed_texts_empty(self, mock_openai):
        emb = Embedder()
        results = emb.embed_texts([])
        assert results == []
        mock_openai.embeddings.create.assert_not_called()

    def test_embed_texts_ordering(self, mock_openai):
        mock_response = MagicMock()
        mock_response.data = [
            MagicMock(index=2, embedding=[0.5, 0.6]),
            MagicMock(index=0, embedding=[0.1, 0.2]),
            MagicMock(index=1, embedding=[0.3, 0.4]),
        ]
        mock_openai.embeddings.create.return_value = mock_response

        emb = Embedder()
        results = emb.embed_texts(["a", "b", "c"])
        assert results == [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]

    def test_embed_query(self, mock_openai):
        mock_response = MagicMock()
        mock_response.data = [MagicMock(index=0, embedding=[0.9, 0.8])]
        mock_openai.embeddings.create.return_value = mock_response

        emb = Embedder()
        result = emb.embed_query("what is this?")
        assert result == [0.9, 0.8]

    def test_dimension(self, mock_openai):
        mock_response = MagicMock()
        mock_response.data = [MagicMock(index=0, embedding=[0.1] * 1536)]
        mock_openai.embeddings.create.return_value = mock_response

        emb = Embedder()
        assert emb.dimension == 1536
