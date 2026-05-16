from datetime import datetime

from pydantic import BaseModel


class NotebookMeta(BaseModel):
    notebook_id: str
    source_name: str
    source_type: str
    created_at: datetime
    updated_at: datetime


class EmbeddingVersion(BaseModel):
    version_id: str
    model: str
    chunk_size: int
    chunk_overlap: int
    chunk_strategy: str
    created_at: datetime
    chunk_count: int
    dimension: int


class Chunk(BaseModel):
    chunk_id: str
    notebook_id: str
    version_id: str
    content: str
    heading_path: list[str]
    page_number: int | None = None
    image_refs: list[str] = []
    embedding: list[float] = []


class ChunkResult(BaseModel):
    chunk_id: str
    content: str
    heading_path: list[str]
    page_number: int | None = None
    image_refs: list[str] = []
    score: float = 0.0


class EmbedRequest(BaseModel):
    notebook_id: str
    model: str | None = None
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    chunk_strategy: str | None = None


class QueryRequest(BaseModel):
    notebook_id: str
    query: str
    version_id: str | None = None
    top_k: int = 5


class QueryResponse(BaseModel):
    chunks: list[ChunkResult]


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    notebook_id: str
    query: str
    history: list[ChatMessage] = []
    version_id: str | None = None
    top_k: int = 5
    model: str | None = None
