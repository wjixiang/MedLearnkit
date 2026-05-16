from unittest.mock import MagicMock, patch

from typer.testing import CliRunner

runner = CliRunner()


class TestCLI:
    @patch("cli._get_service")
    def test_convert(self, mock_get_service):
        from cli import app as cli_app
        from lib.models import NotebookMeta
        from datetime import datetime, timezone

        mock_svc = MagicMock()
        mock_get_service.return_value = mock_svc
        mock_svc.convert.return_value = NotebookMeta(
            notebook_id="nb-001", source_name="test.pdf", source_type="pdf",
            created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
        )

        result = runner.invoke(cli_app, ["convert", "test.pdf"])
        assert result.exit_code == 0
        assert "nb-001" in result.output
        mock_svc.convert.assert_called_once()

    @patch("cli._get_service")
    def test_embed(self, mock_get_service):
        from cli import app as cli_app
        from lib.models import EmbeddingVersion
        from datetime import datetime, timezone

        mock_svc = MagicMock()
        mock_get_service.return_value = mock_svc
        mock_svc.embed.return_value = EmbeddingVersion(
            version_id="v1", model="m", chunk_size=512, chunk_overlap=64,
            chunk_strategy="heading", created_at=datetime.now(timezone.utc),
            chunk_count=10, dimension=1536,
        )

        result = runner.invoke(cli_app, ["embed", "nb-001"])
        assert result.exit_code == 0
        assert "v1" in result.output

    @patch("cli._get_service")
    def test_query(self, mock_get_service):
        from cli import app as cli_app
        from lib.models import ChunkResult

        mock_svc = MagicMock()
        mock_get_service.return_value = mock_svc
        mock_svc.query.return_value = [
            ChunkResult(chunk_id="c1", content="result text here", heading_path=["Ch1"], score=0.95),
        ]

        result = runner.invoke(cli_app, ["query", "nb-001", "what is AI?"])
        assert result.exit_code == 0
        assert "result text" in result.output

    @patch("cli._get_service")
    def test_query_no_results(self, mock_get_service):
        from cli import app as cli_app

        mock_svc = MagicMock()
        mock_get_service.return_value = mock_svc
        mock_svc.query.return_value = []

        result = runner.invoke(cli_app, ["query", "nb-001", "nothing"])
        assert result.exit_code == 0
        assert "No results" in result.output
