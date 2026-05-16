import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from lib.embedder import Embedder
from lib.models import ChatRequest, EmbedRequest, QueryRequest, QueryResponse
from lib.service import NotebookService
from lib.storage import Storage


def create_service() -> NotebookService:
    storage = Storage.from_env()
    embedder = Embedder()
    lance_db_uri = os.getenv("LANCE_DB_URI", "/tmp/notebook-rag-lance")
    lance_storage_options = _build_lance_storage_options()
    return NotebookService(
        storage,
        embedder=embedder,
        lance_db_uri=lance_db_uri,
        lance_storage_options=lance_storage_options,
    )


def _build_lance_storage_options() -> dict | None:
    uri = os.getenv("LANCE_DB_URI", "")
    if not uri.startswith("s3://"):
        return None
    bucket = uri.removeprefix("s3://")
    region = os.getenv("OPENDAL_OSS_REGION", "oss-cn-beijing")
    return {
        "region": region,
        "endpoint": f"https://{bucket}.oss-{region}.aliyuncs.com",
        "access_key_id": os.getenv("OPENDAL_OSS_ACCESS_KEY_ID"),
        "secret_access_key": os.getenv("OPENDAL_OSS_ACCESS_KEY_SECRET"),
        "virtual_hosted_style_request": "True",
    }


_service: NotebookService | None = None


def get_service() -> NotebookService:
    global _service
    if _service is None:
        _service = create_service()
    return _service


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    get_service()
    yield


app = FastAPI(title="Notebook RAG API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/notebooks/convert")
async def convert_file(file: UploadFile = File(...)):
    svc = get_service()
    data = await file.read()
    filename = file.filename or "unknown"
    try:
        meta = svc.convert_bytes(data, filename)
        return JSONResponse(content=meta.model_dump(mode="json"), status_code=201)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/notebooks/embed")
async def embed_notebook(req: EmbedRequest):
    svc = get_service()
    try:
        version = svc.embed(
            req.notebook_id,
            model=req.model,
            chunk_size=req.chunk_size,
            chunk_overlap=req.chunk_overlap,
            chunk_strategy=req.chunk_strategy,
        )
        return JSONResponse(content=version.model_dump(mode="json"), status_code=201)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/notebooks/query")
async def query_notebook(req: QueryRequest):
    svc = get_service()
    try:
        results = svc.query(
            req.notebook_id,
            req.query,
            version_id=req.version_id,
            top_k=req.top_k,
        )
        resp = QueryResponse(chunks=[r.model_dump(mode="json") for r in results])
        return resp
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/notebooks")
async def list_notebooks():
    svc = get_service()
    metas = svc.list_notebooks()
    return [m.model_dump(mode="json") for m in metas]


@app.get("/notebooks/{notebook_id}/versions")
async def list_versions(notebook_id: str):
    svc = get_service()
    try:
        versions = svc.list_versions(notebook_id)
        return [v.model_dump(mode="json") for v in versions]
    except Exception:
        raise HTTPException(status_code=404, detail=f"Notebook {notebook_id} not found")


@app.delete("/notebooks/{notebook_id}")
async def delete_notebook(notebook_id: str):
    svc = get_service()
    svc.delete_notebook(notebook_id)
    return {"ok": True}


@app.delete("/notebooks/{notebook_id}/versions/{version_id}")
async def delete_version(notebook_id: str, version_id: str):
    svc = get_service()
    try:
        svc.delete_version(notebook_id, version_id)
        return {"ok": True}
    except Exception:
        raise HTTPException(status_code=404, detail="Version not found")


@app.post("/chat")
async def chat(req: ChatRequest):
    """RAG Q&A streaming endpoint. Returns NDJSON stream."""
    import json as _json

    svc = get_service()

    async def generate() -> AsyncGenerator[str, None]:
        try:
            async for line in svc.chat_stream(
                notebook_id=req.notebook_id,
                query=req.query,
                history=req.history,
                version_id=req.version_id,
                top_k=req.top_k,
                model=req.model,
            ):
                yield line + "\n"
        except Exception as e:
            yield _json.dumps({"type": "error", "content": str(e)}) + "\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
