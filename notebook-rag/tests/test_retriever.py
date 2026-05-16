from unittest.mock import MagicMock, patch

from lib.embedder import Embedder
from lib.models import ChunkResult
from lib.retriever import Retriever
from lib.vector_store import VectorStore


class TestRetriever:
    def test_retrieve(self):
        mock_embedder = MagicMock(spec=Embedder)
        mock_embedder.embed_query.return_value = [0.1, 0.2, 0.3]

        mock_vs = MagicMock(spec=VectorStore)
        mock_vs.search.return_value = [
            ChunkResult(chunk_id="c1", content="result 1", heading_path=["Ch1"], score=0.95),
            ChunkResult(chunk_id="c2", content="result 2", heading_path=["Ch2"], score=0.85),
        ]

        retriever = Retriever(mock_embedder, mock_vs)
        results = retriever.retrieve("my_table", "what is machine learning?", top_k=5)

        assert len(results) == 2
        assert results[0].chunk_id == "c1"
        assert results[0].score == 0.95
        mock_embedder.embed_query.assert_called_once_with("what is machine learning?")
        mock_vs.search.assert_called_once_with("my_table", [0.1, 0.2, 0.3], 5)

    def test_retrieve_empty(self):
        mock_embedder = MagicMock(spec=Embedder)
        mock_embedder.embed_query.return_value = [0.1, 0.2]

        mock_vs = MagicMock(spec=VectorStore)
        mock_vs.search.return_value = []

        retriever = Retriever(mock_embedder, mock_vs)
        results = retriever.retrieve("t1", "query")
        assert results == []

    def test_retrieve_top_k(self):
        mock_embedder = MagicMock(spec=Embedder)
        mock_embedder.embed_query.return_value = [0.1]

        mock_vs = MagicMock(spec=VectorStore)
        mock_vs.search.return_value = [ChunkResult(chunk_id="c1", content="r", heading_path=[])] * 3

        retriever = Retriever(mock_embedder, mock_vs)
        results = retriever.retrieve("t1", "q", top_k=3)
        assert len(results) == 3
        mock_vs.search.assert_called_once_with("t1", [0.1], 3)
