from unittest.mock import MagicMock, patch

import pytest

from lib.converter import Converter, ConvertResult


class TestConverterMocked:
    @pytest.fixture
    def mock_converter(self):
        with patch("lib.converter.DocumentConverter") as mock_cls:
            mock_inst = MagicMock()
            mock_cls.return_value = mock_inst

            mock_doc = MagicMock()
            mock_doc.export_to_markdown.return_value = "# Hello\n\nWorld"
            mock_doc.pictures = []

            mock_result = MagicMock()
            mock_result.document = mock_doc
            mock_inst.convert.return_value = mock_result

            conv = Converter()
            yield conv, mock_inst

    def test_convert_file(self, mock_converter):
        conv, mock_inst = mock_converter
        result = conv.convert_file("/path/to/doc.pdf")
        assert isinstance(result, ConvertResult)
        assert result.markdown == "# Hello\n\nWorld"
        assert result.image_refs == []
        mock_inst.convert.assert_called_once()

    def test_convert_bytes(self, mock_converter):
        conv, mock_inst = mock_converter
        result = conv.convert_bytes(b"fake-pdf-data", "doc.pdf")
        assert result.markdown == "# Hello\n\nWorld"
        mock_inst.convert.assert_called_once()

    def test_convert_bytes_docx(self, mock_converter):
        conv, mock_inst = mock_converter
        result = conv.convert_bytes(b"fake-data", "document.docx")
        assert isinstance(result, ConvertResult)

    def test_extract_image_refs(self, mock_converter):
        conv, mock_inst = mock_converter
        mock_doc = MagicMock()
        mock_doc.export_to_markdown.return_value = "# Doc\n\n![img](image1.png)"
        pic1 = MagicMock()
        pic1.id = "img001"
        pic2 = MagicMock()
        pic2.id = "img002"
        mock_doc.pictures = [pic1, pic2]
        mock_inst.convert.return_value.document = mock_doc
        result = conv.convert_file("/path/doc.pdf")
        assert result.image_refs == ["img001", "img002"]

    def test_extract_image_refs_empty(self, mock_converter):
        conv, mock_inst = mock_converter
        mock_doc = MagicMock()
        mock_doc.export_to_markdown.return_value = "# No images"
        mock_doc.pictures = []
        mock_inst.convert.return_value.document = mock_doc
        result = conv.convert_file("/path/doc.pdf")
        assert result.image_refs == []

    def test_convert_result_dataclass(self):
        r = ConvertResult(markdown="# Test", image_refs=["a.png"])
        assert r.markdown == "# Test"
        assert r.image_refs == ["a.png"]
