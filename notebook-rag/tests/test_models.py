from datetime import datetime

from lib.models import (
    Chunk,
    ChunkResult,
    EmbedRequest,
    EmbeddingVersion,
    NotebookMeta,
    QueryRequest,
    QueryResponse,
)


def test_notebook_meta():
    now = datetime.now()
    meta = NotebookMeta(
        notebook_id="nb-001",
        source_name="test.pdf",
        source_type="pdf",
        created_at=now,
        updated_at=now,
    )
    assert meta.notebook_id == "nb-001"
    assert meta.source_type == "pdf"
    data = meta.model_dump()
    restored = NotebookMeta.model_validate(data)
    assert restored == meta


def test_embedding_version():
    now = datetime.now()
    ver = EmbeddingVersion(
        version_id="v1",
        model="text-embedding-3-small",
        chunk_size=512,
        chunk_overlap=64,
        chunk_strategy="heading",
        created_at=now,
        chunk_count=10,
        dimension=1536,
    )
    assert ver.chunk_strategy == "heading"
    assert ver.dimension == 1536
    data = ver.model_dump()
    restored = EmbeddingVersion.model_validate(data)
    assert restored == ver


def test_chunk_defaults():
    chunk = Chunk(
        chunk_id="c1",
        notebook_id="nb-001",
        version_id="v1",
        content="hello",
        heading_path=["Ch1"],
    )
    assert chunk.page_number is None
    assert chunk.image_refs == []
    assert chunk.embedding == []


def test_chunk_full():
    chunk = Chunk(
        chunk_id="c1",
        notebook_id="nb-001",
        version_id="v1",
        content="hello",
        heading_path=["Ch1", "Sec1.1"],
        page_number=3,
        image_refs=["img1.png"],
        embedding=[0.1, 0.2],
    )
    assert chunk.page_number == 3
    assert len(chunk.heading_path) == 2


def test_chunk_result_defaults():
    result = ChunkResult(
        chunk_id="c1",
        content="hello",
        heading_path=[],
    )
    assert result.score == 0.0
    assert result.image_refs == []
    assert result.page_number is None


def test_embed_request_defaults():
    req = EmbedRequest(notebook_id="nb-001")
    assert req.model is None
    assert req.chunk_size is None


def test_query_request_defaults():
    req = QueryRequest(notebook_id="nb-001", query="test")
    assert req.top_k == 5
    assert req.version_id is None


def test_query_response():
    resp = QueryResponse(chunks=[])
    assert len(resp.chunks) == 0
    resp2 = QueryResponse(chunks=[
        ChunkResult(chunk_id="c1", content="a", heading_path=[], score=0.9),
    ])
    assert resp2.chunks[0].score == 0.9
