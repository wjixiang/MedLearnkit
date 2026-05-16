import os

from openai import OpenAI


class Embedder:
    BATCH_SIZE = 10

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
    ):
        self.model = model or os.getenv("DEFAULT_EMBEDDING_MODEL", "text-embedding-3-small")
        self._client = OpenAI(
            api_key=api_key or os.getenv("OPENAI_API_KEY", "sk-placeholder"),
            base_url=base_url or os.getenv("OPENAI_BASE_URL"),
        )

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts), self.BATCH_SIZE):
            batch = texts[i : i + self.BATCH_SIZE]
            resp = self._client.embeddings.create(input=batch, model=self.model)
            sorted_data = sorted(resp.data, key=lambda x: x.index)
            all_embeddings.extend([item.embedding for item in sorted_data])
        return all_embeddings

    def embed_query(self, query: str) -> list[float]:
        results = self.embed_texts([query])
        return results[0]

    @property
    def dimension(self) -> int:
        result = self.embed_texts(["dimension probe"])
        return len(result[0])
