import json
from contextlib import contextmanager

import lance
import lancedb
import pyarrow as pa

from lib.models import Chunk, ChunkResult


@contextmanager
def _oss_commit_lock(version: int):
    """No-op commit lock for OSS which doesn't support If-None-Match."""
    yield


class VectorStore:
    def __init__(self, db_uri: str, storage_options: dict | None = None):
        self._db_uri = db_uri
        self._storage_options = storage_options or {}
        self._db = lancedb.connect(db_uri, storage_options=self._storage_options)

    def create_table(self, table_name: str, chunks: list[Chunk]) -> None:
        if not chunks:
            return
        rows = [self._chunk_to_values(c) for c in chunks]
        schema = self._schema_for_chunks(chunks)
        data = pa.Table.from_pylist(rows, schema=schema)
        uri = f"{self._db_uri}/{table_name}.lance"
        lance.write_dataset(
            data,
            uri=uri,
            schema=schema,
            mode="create",
            storage_options=self._storage_options,
            commit_lock=_oss_commit_lock,
        )

    def add_chunks(self, table_name: str, chunks: list[Chunk]) -> None:
        if not chunks:
            return
        rows = [self._chunk_to_values(c) for c in chunks]
        schema = self._schema_for_chunks(chunks)
        data = pa.Table.from_pylist(rows, schema=schema)
        uri = f"{self._db_uri}/{table_name}.lance"
        lance.write_dataset(
            data,
            uri=uri,
            schema=schema,
            mode="append",
            storage_options=self._storage_options,
            commit_lock=_oss_commit_lock,
        )

    def search(
        self, table_name: str, query_vector: list[float], top_k: int = 5
    ) -> list[ChunkResult]:
        table = self._db.open_table(table_name, storage_options=self._storage_options)
        results = (
            table.search(query_vector)
            .limit(top_k)
            .metric("cosine")
            .to_pandas()
        )
        chunk_results = []
        for _, row in results.iterrows():
            chunk_results.append(
                ChunkResult(
                    chunk_id=row["chunk_id"],
                    content=row["content"],
                    heading_path=json.loads(row["heading_path"]),
                    page_number=json.loads(row["page_number"]),
                    image_refs=json.loads(row["image_refs"]),
                    score=1.0 - row["_distance"],
                )
            )
        return chunk_results

    def delete_table(self, table_name: str) -> None:
        try:
            self._db.drop_table(table_name)
        except Exception:
            pass

    def table_exists(self, table_name: str) -> bool:
        resp = self._db.list_tables()
        table_names = resp.tables if hasattr(resp, "tables") else list(resp)
        return table_name in table_names

    def _schema_for_chunks(self, chunks: list[Chunk]) -> pa.Schema:
        dim = len(chunks[0].embedding)
        return pa.schema([
            pa.field("chunk_id", pa.string()),
            pa.field("notebook_id", pa.string()),
            pa.field("version_id", pa.string()),
            pa.field("content", pa.string()),
            pa.field("heading_path", pa.string()),
            pa.field("page_number", pa.string()),
            pa.field("image_refs", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), dim)),
        ])

    def _chunk_to_values(self, chunk: Chunk) -> dict:
        return {
            "chunk_id": chunk.chunk_id,
            "notebook_id": chunk.notebook_id,
            "version_id": chunk.version_id,
            "content": chunk.content,
            "heading_path": json.dumps(chunk.heading_path),
            "page_number": json.dumps(chunk.page_number),
            "image_refs": json.dumps(chunk.image_refs),
            "vector": chunk.embedding,
        }
