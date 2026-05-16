import logging
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from docling.document_converter import DocumentConverter

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from docling_core.types.doc import DoclingDocument


@dataclass
class ConvertResult:
    markdown: str
    image_refs: list[str]
    docling_doc: "DoclingDocument | None" = field(default=None, repr=False)


class Converter:
    def __init__(self):
        self._converter = DocumentConverter()

    def convert_file(self, file_path: str) -> ConvertResult:
        logger.info("Converting file: %s", file_path)
        t0 = time.time()
        result = self._converter.convert(file_path)
        logger.info("Docling convert done in %.1fs, status=%s", time.time() - t0, result.status)
        doc = result.document
        markdown = doc.export_to_markdown()
        logger.info("Exported markdown: %d chars", len(markdown))
        image_refs = self._extract_image_refs(doc)
        logger.info("Extracted %d image refs", len(image_refs))
        return ConvertResult(markdown=markdown, image_refs=image_refs, docling_doc=doc)

    def convert_bytes(self, data: bytes, filename: str) -> ConvertResult:
        import io
        from docling_core.types.io import DocumentStream
        from docling.datamodel.base_models import InputFormat

        ext = filename.rsplit(".", 1)[-1].lower()
        fmt_map = {
            "pdf": InputFormat.PDF,
            "docx": InputFormat.DOCX,
            "pptx": InputFormat.PPTX,
            "xlsx": InputFormat.XLSX,
            "html": InputFormat.HTML,
            "md": InputFormat.MD,
            "json": InputFormat.JSON_DOCLING,
            "csv": InputFormat.CSV,
            "asciidoc": InputFormat.ASCIIDOC,
            "latex": InputFormat.LATEX,
        }
        fmt = fmt_map.get(ext)
        logger.info("Converting bytes: %s (%s, %d bytes, format=%s)", filename, ext, len(data), fmt)
        t0 = time.time()
        stream = DocumentStream(name=filename, stream=io.BytesIO(data))
        result = self._converter.convert(stream)
        logger.info("Docling convert done in %.1fs, status=%s", time.time() - t0, result.status)
        doc = result.document
        markdown = doc.export_to_markdown()
        logger.info("Exported markdown: %d chars", len(markdown))
        image_refs = self._extract_image_refs(doc)
        logger.info("Extracted %d image refs", len(image_refs))
        return ConvertResult(markdown=markdown, image_refs=image_refs, docling_doc=doc)

    def convert_markdown(self, markdown: str, filename: str = "doc.md") -> ConvertResult:
        from docling.datamodel.base_models import InputFormat

        logger.info("Converting markdown string: %s (%d chars)", filename, len(markdown))
        t0 = time.time()
        result = self._converter.convert_string(markdown, InputFormat.MD, name=filename)
        logger.info("Docling convert_string done in %.1fs, status=%s", time.time() - t0, result.status)
        doc = result.document
        md = doc.export_to_markdown()
        logger.info("Exported markdown: %d chars", len(md))
        return ConvertResult(markdown=md, image_refs=[], docling_doc=doc)

    def _extract_image_refs(self, doc) -> list[str]:
        refs = []
        try:
            for item in doc.pictures:
                if hasattr(item, "id") and item.id:
                    refs.append(str(item.id))
        except Exception:
            pass
        return refs
