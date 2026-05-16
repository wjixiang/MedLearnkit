## Notebook RAG

基于 docling + lancedb + OpenAI SDK 的 Notebook RAG 系统，支持任意 OpenAI 兼容的 Embedding 服务。通过 Typer CLI 与 FastAPI 双通道操作，共享同一套核心业务逻辑。

## 架构

```
┌──────────┐   ┌──────────┐
│ Typer CLI│   │ FastAPI  │
└────┬─────┘   └────┬─────┘
     │              │
     └──────┬───────┘
            ▼
     ┌──────────────┐
     │  Service 层  │  统一业务逻辑入口
     └──────┬───────┘
            ▼
     ┌──────────────┐
     │  核心模块层   │  storage / converter / chunker / embedder / vector_store / retriever
     └──────────────┘
```

CLI 与 FastAPI 不直接调用核心模块，而是统一通过 Service 层交互，保证双通道行为一致。

## 存储设计

opendal + OSS：存储 notebook 元信息、原始文件、markdown、版本索引等结构化数据。

LanceDB（本地或 OSS）：存储向量数据。本地路径（如 `/tmp/notebook-rag-lance`）直接使用；OSS 路径（如 `oss://bucket/prefix`）通过 `virtual_hosted_style_request=True` 适配阿里云 OSS（需 RAM 用户具备 S3 API 权限）。

### 存储映射

| 数据类型 | 存储位置 | 说明 |
|----------|---------|------|
| Notebook 元信息 | opendal (OSS) `notebooks/{notebook_id}/meta.json` | Pydantic 序列化 |
| 原始文件 | opendal (OSS) `notebooks/{notebook_id}/raw/source.{ext}` | 二进制原始文件 |
| 提取图片 | opendal (OSS) `notebooks/{notebook_id}/raw/images/{hash}.{ext}` | docling 提取的图片 |
| Markdown 全文 | opendal (OSS) `notebooks/{notebook_id}/raw/markdown.md` | 转换结果 |
| 版本索引 | opendal (OSS) `notebooks/{notebook_id}/embedding/versions.json` | 版本列表 |
| 版本配置 | opendal (OSS) `notebooks/{notebook_id}/embedding/{version_id}/config.json` | 嵌入参数 |
| 向量数据 | `LANCE_DB_URI/{notebook_id}/{version_id}/` | LanceDB 表目录（本地或 OSS） |

### opendal Operator 接口封装（storage.py）

```python
class Storage:
    @classmethod
    def from_env(cls) -> "Storage": ...

    @property
    def operator(self) -> opendal.Operator: ...

    def write_meta(self, notebook_id: str, meta: NotebookMeta) -> None: ...
    def read_meta(self, notebook_id: str) -> NotebookMeta: ...
    def write_source(self, notebook_id: str, data: bytes, ext: str) -> None: ...
    def read_source(self, notebook_id: str) -> tuple[bytes, str]: ...
    def write_image(self, notebook_id: str, hash_key: str, data: bytes, ext: str) -> None: ...
    def read_image(self, notebook_id: str, hash_key: str) -> tuple[bytes, str]: ...
    def write_markdown(self, notebook_id: str, content: str) -> None: ...
    def read_markdown(self, notebook_id: str) -> str: ...
    def write_versions(self, notebook_id: str, versions: list[EmbeddingVersion]) -> None: ...
    def read_versions(self, notebook_id: str) -> list[EmbeddingVersion]: ...
    def write_version_config(self, notebook_id: str, version_id: str, config: EmbeddingVersion) -> None: ...
    def read_version_config(self, notebook_id: str, version_id: str) -> EmbeddingVersion: ...
    def list_notebooks(self) -> list[str]: ...
    def delete_notebook(self, notebook_id: str) -> None: ...
    def delete_version(self, notebook_id: str, version_id: str) -> None: ...
```

### 核心数据模型（Pydantic）

```python
class NotebookMeta(BaseModel):
    notebook_id: str
    source_name: str
    source_type: str          # pdf, pptx, ...
    created_at: datetime
    updated_at: datetime

class EmbeddingVersion(BaseModel):
    version_id: str
    model: str                # e.g. text-embedding-3-small
    chunk_size: int
    chunk_overlap: int
    chunk_strategy: str       # heading, fixed, semantic
    created_at: datetime
    chunk_count: int
    dimension: int

class Chunk(BaseModel):
    chunk_id: str
    notebook_id: str
    version_id: str
    content: str
    heading_path: list[str]   # e.g. ["Chapter 1", "Section 1.1"]
    page_number: int | None
    image_refs: list[str]     # 引用的图片 key
    embedding: list[float]
```

### 请求/响应模型（API 专用）

```python
class ConvertRequest(BaseModel):
    file: UploadFile                   # FastAPI UploadFile

class EmbedRequest(BaseModel):
    notebook_id: str
    model: str | None = None           # 使用默认值时可不传
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    chunk_strategy: str | None = None

class QueryRequest(BaseModel):
    notebook_id: str
    query: str
    version_id: str | None = None      # 默认使用最新版本
    top_k: int = 5

class QueryResponse(BaseModel):
    chunks: list[ChunkResult]

class ChunkResult(BaseModel):
    chunk_id: str
    content: str
    heading_path: list[str]
    page_number: int | None
    image_refs: list[str]
    score: float
```

## 模块划分

```
lib/
  __init__.py
  models.py               # Pydantic 数据模型（业务 + API 请求响应）
  storage.py              # opendal Operator 封装，统一全部后端存储读写
  converter.py            # docling 转换：notebook -> markdown + images
  chunker.py              # 文本分块策略（按标题层级 / 固定长度）
  embedder.py             # 调用 OpenAI SDK 兼容的 embedding 接口
  vector_store.py         # lancedb 读写：建表、写入、查询
  retriever.py            # 查询：embedding 查询
  service.py              # Service 层：CLI 与 API 共享的业务逻辑入口
cli.py                    # typer CLI 入口
server.py                 # FastAPI 应用入口
main.py                   # 统一入口，支持 run CLI / serve API
```

## Service 层

所有业务逻辑收敛到 `service.py`，CLI 和 API 仅负责参数解析与响应格式化。

```python
class NotebookService:
    def convert(self, source_path: str, notebook_id: str | None = None) -> NotebookMeta: ...
    def embed(self, notebook_id: str, *, model: str | None, chunk_size: int | None,
              chunk_overlap: int | None, chunk_strategy: str | None) -> EmbeddingVersion: ...
    def query(self, notebook_id: str, query: str, *, version_id: str | None = None,
              top_k: int = 5) -> list[ChunkResult]: ...
    def list_notebooks(self) -> list[NotebookMeta]: ...
    def list_versions(self, notebook_id: str) -> list[EmbeddingVersion]: ...
    def delete_notebook(self, notebook_id: str) -> None: ...
    def delete_version(self, notebook_id: str, version_id: str) -> None: ...
```

## CLI 命令

```
notebook-rag convert  <file>                              # 转换文件为 markdown
notebook-rag embed    <notebook_id>                       # 嵌入（支持 --model, --chunk-size, --strategy）
notebook-rag query    <notebook_id> <query>               # 查询，返回相关 chunk
notebook-rag list                                        # 列出所有 notebook
notebook-rag versions <notebook_id>                       # 列出嵌入版本
notebook-rag delete   <notebook_id>                       # 删除 notebook
notebook-rag delete-version <notebook_id> <version_id>    # 删除某版本嵌入
notebook-rag serve                                       # 启动 FastAPI 服务（uvicorn）
```

## API 端点

| Method | Path | 说明 |
|--------|------|------|
| `POST` | `/notebooks/convert` | 上传文件并转换（multipart/form-data） |
| `POST` | `/notebooks/embed` | 对 notebook 执行嵌入 |
| `POST` | `/notebooks/query` | 查询相关 chunk |
| `GET` | `/notebooks` | 列出所有 notebook |
| `GET` | `/notebooks/{notebook_id}/versions` | 列出嵌入版本 |
| `DELETE` | `/notebooks/{notebook_id}` | 删除 notebook |
| `DELETE` | `/notebooks/{notebook_id}/versions/{version_id}` | 删除某版本嵌入 |

## 分块策略

- **heading**（推荐）：按 markdown 标题层级切分，保留 heading_path 上下文
- **fixed**：固定 token 数 + overlap
- **semantic**：用 embedding 相似度检测语义边界

## 查询流程

```
用户输入 query
  -> embedder.embed(query) 获取 query embedding
  -> vector_store.search(notebook_id, version_id, query_vector, top_k)
  -> 返回 Chunk 列表（含 heading_path、page_number、image_refs）
```

## 环境变量

Embedding 通过 OpenAI SDK 调用，`OPENAI_BASE_URL` 可指向任意兼容服务（OpenAI、Azure OpenAI、vLLM、Ollama 等）。

```env
# Embedding
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DEFAULT_EMBEDDING_MODEL=text-embedding-v4
DEFAULT_CHUNK_SIZE=512
DEFAULT_CHUNK_OVERLAP=64

# LanceDB（本地文件系统）
LANCE_DB_URI=/tmp/notebook-rag-lance

# Storage（opendal + OSS）
OPENDAL_SCHEME=oss
OPENDAL_OSS_BUCKET=notebook-rag
OPENDAL_OSS_REGION=oss-cn-beijing
OPENDAL_OSS_ACCESS_KEY_ID=...
OPENDAL_OSS_ACCESS_KEY_SECRET=...
OPENDAL_OSS_ENDPOINT=https://oss-cn-beijing.aliyuncs.com
```
