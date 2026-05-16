import shutil

import pytest

from lib.models import Chunk
from lib.vector_store import VectorStore


@pytest.fixture
def db_dir(tmp_path):
    d = tmp_path / "lancedb"
    d.mkdir()
    yield str(d)
    shutil.rmtree(str(d), ignore_errors=True)


def _make_chunks(count=3, dim=4) -> list[Chunk]:
    chunks = []
    for i in range(count):
        chunks.append(
            Chunk(
                chunk_id=f"c{i}",
                notebook_id="nb-001",
                version_id="v1",
                content=f"Content number {i}",
                heading_path=["Ch1", f"Sec{i}"],
                page_number=i + 1,
                image_refs=[f"img{i}.png"],
                embedding=[float(i + 1)] * dim,
            )
        )
    return chunks


class TestVectorStore:
    def test_create_and_search(self, db_dir):
        store = VectorStore(db_dir)
        chunks = _make_chunks(3, 4)
        store.create_table("test_t", chunks)

        results = store.search("test_t", [1.0, 1.0, 1.0, 1.0], top_k=2)
        assert len(results) == 2
        assert results[0].chunk_id == "c0"
        assert results[0].heading_path == ["Ch1", "Sec0"]
        assert results[0].image_refs == ["img0.png"]
        assert results[0].score > 0

    def test_create_empty(self, db_dir):
        store = VectorStore(db_dir)
        store.create_table("empty_t", [])
        assert not store.table_exists("empty_t")

    def test_table_exists(self, db_dir):
        store = VectorStore(db_dir)
        chunks = _make_chunks(1, 4)
        store.create_table("exists_t", chunks)
        assert store.table_exists("exists_t")
        assert not store.table_exists("nope_t")

    def test_delete_table(self, db_dir):
        store = VectorStore(db_dir)
        chunks = _make_chunks(1, 4)
        store.create_table("del_t", chunks)
        assert store.table_exists("del_t")
        store.delete_table("del_t")
        assert not store.table_exists("del_t")

    def test_delete_nonexistent(self, db_dir):
        store = VectorStore(db_dir)
        store.delete_table("nope")

    def test_search_top_k(self, db_dir):
        store = VectorStore(db_dir)
        chunks = _make_chunks(5, 4)
        store.create_table("topk_t", chunks)
        results = store.search("topk_t", [1.0, 1.0, 1.0, 1.0], top_k=3)
        assert len(results) == 3

    def test_heading_path_roundtrip(self, db_dir):
        store = VectorStore(db_dir)
        chunk = Chunk(
            chunk_id="c1",
            notebook_id="nb-001",
            version_id="v1",
            content="test",
            heading_path=["Level1", "Level2", "Level3"],
            embedding=[0.1, 0.2],
        )
        store.create_table("hp_t", [chunk])
        results = store.search("hp_t", [0.1, 0.2], top_k=1)
        assert results[0].heading_path == ["Level1", "Level2", "Level3"]

    def test_none_page_number(self, db_dir):
        store = VectorStore(db_dir)
        chunk = Chunk(
            chunk_id="c1",
            notebook_id="nb-001",
            version_id="v1",
            content="test",
            heading_path=[],
            page_number=None,
            embedding=[0.1, 0.2],
        )
        store.create_table("pn_t", [chunk])
        results = store.search("pn_t", [0.1, 0.2], top_k=1)
        assert results[0].page_number is None
