from lib.embedder import Embedder
from lib.models import ChunkResult
from lib.vector_store import VectorStore


class Retriever:
    def __init__(self, embedder: Embedder, vector_store: VectorStore):
        self._embedder = embedder
        self._vector_store = vector_store

    def retrieve(
        self,
        table_name: str,
        query: str,
        top_k: int = 5,
    ) -> list[ChunkResult]:
        query_vector = self._embedder.embed_query(query)
        return self._vector_store.search(table_name, query_vector, top_k)
