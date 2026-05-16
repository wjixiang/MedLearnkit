import os
import sys

import typer
import uvicorn

app = typer.Typer()


@app.command()
def serve(
    host: str = typer.Option("0.0.0.0", "--host", "-h"),
    port: int = typer.Option(8000, "--port", "-p"),
    reload: bool = typer.Option(False, "--reload"),
):
    """Start the FastAPI server."""
    uvicorn.run("server:app", host=host, port=port, reload=reload)


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    if ctx.invoked_subcommand is None:
        from cli import app as cli_app
        cli_app()


if __name__ == "__main__":
    app()
