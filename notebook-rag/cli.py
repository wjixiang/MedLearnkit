from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import typer
from dotenv import load_dotenv
from rich.console import Console

from lib.service import NotebookService

# Load .env file
load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

app = typer.Typer(help="Notebook RAG CLI")
console = Console()


def _get_service() -> NotebookService:
    from lib.embedder import Embedder
    from lib.service import NotebookService
    from lib.storage import Storage

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
    if not uri.startswith("oss://"):
        return None
    return {
        "region": os.getenv("OPENDAL_OSS_REGION", "oss-cn-beijing"),
        "endpoint": os.getenv(
            "OPENDAL_OSS_ENDPOINT", "https://oss-cn-beijing.aliyuncs.com"
        ),
        "access_key_id": os.getenv("OPENDAL_OSS_ACCESS_KEY_ID"),
        "secret_access_key": os.getenv("OPENDAL_OSS_ACCESS_KEY_SECRET"),
        "virtual_hosted_style_request": "True",
    }


@app.command()
def convert(
    file: str,
    notebook_id: str | None = typer.Argument(None),
    model: str | None = typer.Option(None, "--model", "-m"),
    chunk_size: int | None = typer.Option(None, "--chunk-size", "-s"),
    chunk_overlap: int | None = typer.Option(None, "--chunk-overlap", "-o"),
    chunk_strategy: str | None = typer.Option("docling", "--strategy", "-t"),
):
    """Convert a file, chunk it, and embed it in one atomic operation.

    If any step fails, all changes are rolled back.
    """
    from lib.service import EmbeddingError

    svc = _get_service()
    try:
        meta, version = svc.convert_and_embed(
            file,
            notebook_id=notebook_id,
            model=model,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            chunk_strategy=chunk_strategy,
        )
        console.print(
            f"[green]Converted & Embedded[/green]: {meta.notebook_id} ({meta.source_name})"
        )
        console.print(
            f"  version={version.version_id}, chunks={version.chunk_count}, "
            f"dim={version.dimension}, strategy={version.chunk_strategy}"
        )
    except EmbeddingError as e:
        console.print(f"[red]Error[/red]: {e}")
        raise typer.Exit(1)


@app.command()
def embed(
    notebook_id: str,
    model: str | None = typer.Option(None, "--model", "-m"),
    chunk_size: int | None = typer.Option(None, "--chunk-size", "-s"),
    chunk_overlap: int | None = typer.Option(None, "--chunk-overlap", "-o"),
    chunk_strategy: str | None = typer.Option("docling", "--strategy", "-t"),
):
    """Embed a notebook."""
    svc = _get_service()
    version = svc.embed(
        notebook_id,
        model=model,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        chunk_strategy=chunk_strategy,
    )
    console.print(
        f"[green]Embedded[/green]: version={version.version_id}, "
        f"chunks={version.chunk_count}, dim={version.dimension}"
    )


@app.command()
def ls(
    output: str | None = typer.Option(None, "--output", "-o"),
):
    """List all notebooks."""
    svc = _get_service()
    notebooks = svc.list_notebooks()
    if not notebooks:
        console.print("[yellow]No notebooks found[/yellow]")
        return

    if output == "json":
        data = [nb.model_dump(mode="json") for nb in notebooks]
        console.print(json.dumps(data, indent=2, ensure_ascii=False, default=str))
    else:
        from rich.table import Table

        t = Table(title="Notebooks", show_header=True, header_style="bold magenta")
        t.add_column("ID", style="cyan")
        t.add_column("Source", style="green")
        t.add_column("Type", style="yellow")
        t.add_column("Created", style="blue")
        t.add_column("Updated", style="blue")
        for nb in notebooks:
            t.add_row(
                nb.notebook_id,
                nb.source_name,
                nb.source_type,
                nb.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                nb.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            )
        console.print(t)


@app.command()
def versions(
    notebook_id: str,
    output: str | None = typer.Option(None, "--output", "-o"),
):
    """List all versions of a notebook."""
    svc = _get_service()
    try:
        vers = svc.list_versions(notebook_id)
    except Exception:
        console.print(f"[red]Notebook '{notebook_id}' not found[/red]")
        raise typer.Exit(1)

    if not vers:
        console.print("[yellow]No versions found[/yellow]")
        return

    if output == "json":
        data = [v.model_dump(mode="json") for v in vers]
        console.print(json.dumps(data, indent=2, ensure_ascii=False, default=str))
    else:
        from rich.table import Table

        t = Table(
            title=f"Versions of '{notebook_id}'",
            show_header=True,
            header_style="bold magenta",
        )
        t.add_column("Version", style="cyan")
        t.add_column("Strategy", style="green")
        t.add_column("Chunk Size", style="yellow")
        t.add_column("Chunks", style="yellow")
        t.add_column("Model", style="blue")
        t.add_column("Created", style="blue")
        for v in vers:
            t.add_row(
                v.version_id,
                v.chunk_strategy,
                str(v.chunk_size),
                str(v.chunk_count),
                v.model,
                v.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            )
        console.print(t)


@app.command()
def delete(
    notebook_id: str,
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Delete a notebook and all its data."""
    svc = _get_service()
    if not force:
        from rich.prompt import Confirm

        if not Confirm.ask(
            f"[bold red]Delete notebook '{notebook_id}' and all its versions?[/bold red]"
        ):
            console.print("[yellow]Cancelled[/yellow]")
            return
    svc.delete_notebook(notebook_id)
    console.print(f"[green]Deleted[/green]: {notebook_id}")


@app.command()
def prune(
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
):
    """Remove notebooks that have no valid metadata."""
    svc = _get_service()
    nb_ids = svc._storage.list_notebooks()

    invalid = []
    for nb_id in nb_ids:
        try:
            svc._storage.read_meta(nb_id)
        except Exception:
            invalid.append(nb_id)

    if not invalid:
        console.print("[green]Nothing to prune[/green]")
        return

    console.print(f"Found [yellow]{len(invalid)}[/yellow] invalid notebook(s):")
    for nb_id in invalid:
        console.print(f"  - {nb_id}")

    if not force:
        from rich.prompt import Confirm

        if not Confirm.ask("[bold red]Delete all listed notebooks?[/bold red]"):
            console.print("[yellow]Cancelled[/yellow]")
            return

    for nb_id in invalid:
        svc.delete_notebook(nb_id)
        console.print(f"[green]Deleted[/green]: {nb_id}")


@app.command()
def query(
    notebook_id: str,
    q: str,
    version_id: str | None = typer.Option(None, "--version", "-v"),
    top_k: int = typer.Option(5, "--top-k", "-k"),
):
    """Query a notebook."""
    svc = _get_service()
    results = svc.query(notebook_id, q, version_id=version_id, top_k=top_k)
    if not results:
        console.print("[yellow]No results found[/yellow]")
        return
    for i, r in enumerate(results):
        console.print(f"\n[bold]#{i + 1}[/bold] (score={r.score:.4f})")
        if r.heading_path:
            console.print(f"  Path: {' > '.join(r.heading_path)}")
        console.print(f"  {r.content[:200]}...")


if __name__ == "__main__":
    app()
