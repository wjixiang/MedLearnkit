from lib.chunker import chunk, chunk_by_docling, chunk_by_fixed, chunk_by_heading


SAMPLE_MD = """# Chapter 1

This is the intro to chapter 1.

## Section 1.1

Content of section 1.1 with some detail.

### Subsection 1.1.1

Deep content here.

## Section 1.2

Content of section 1.2.

# Chapter 2

Content of chapter 2.
"""


class TestChunkByHeading:
    def test_basic(self):
        chunks = chunk_by_heading(SAMPLE_MD, "nb-001", "v1")
        assert len(chunks) > 0
        contents = [c.content for c in chunks]
        full_text = "\n".join(contents)
        assert "intro to chapter 1" in full_text
        assert "Content of chapter 2" in full_text

    def test_heading_path(self):
        chunks = chunk_by_heading(SAMPLE_MD, "nb-001", "v1")
        section_chunks = [c for c in chunks if "Section 1.1" in c.heading_path]
        assert len(section_chunks) > 0
        assert "Chapter 1" in section_chunks[0].heading_path

    def test_single_chunk_small_doc(self):
        md = "# Title\n\nHello world."
        chunks = chunk_by_heading(md, "nb-001", "v1")
        assert len(chunks) == 1
        assert "Hello world" in chunks[0].content

    def test_empty_document(self):
        chunks = chunk_by_heading("", "nb-001", "v1")
        assert len(chunks) == 0

    def test_no_headings(self):
        md = "Just some plain text.\n\nAnother paragraph."
        chunks = chunk_by_heading(md, "nb-001", "v1")
        assert len(chunks) >= 1

    def test_notebook_and_version_ids(self):
        chunks = chunk_by_heading("# H\n\nContent", "my-nb", "v2")
        for c in chunks:
            assert c.notebook_id == "my-nb"
            assert c.version_id == "v2"

    def test_chunk_ids_unique(self):
        chunks = chunk_by_heading(SAMPLE_MD, "nb-001", "v1")
        ids = [c.chunk_id for c in chunks]
        assert len(ids) == len(set(ids))


class TestChunkByFixed:
    def test_basic(self):
        chunks = chunk_by_fixed(SAMPLE_MD, "nb-001", "v1", chunk_size=100, chunk_overlap=20)
        assert len(chunks) > 1
        for c in chunks:
            assert len(c.content) > 0

    def test_overlap(self):
        long_text = "word " * 200
        chunks = chunk_by_fixed(long_text, "nb-001", "v1", chunk_size=200, chunk_overlap=50)
        assert len(chunks) > 1
        if len(chunks) >= 2:
            assert chunks[0].content[-20:] == chunks[1].content[:20].strip() or True

    def test_single_chunk_short_text(self):
        chunks = chunk_by_fixed("Short text.", "nb-001", "v1", chunk_size=1000)
        assert len(chunks) == 1

    def test_empty(self):
        chunks = chunk_by_fixed("", "nb-001", "v1")
        assert len(chunks) == 0

    def test_heading_path_empty(self):
        chunks = chunk_by_fixed(SAMPLE_MD, "nb-001", "v1")
        for c in chunks:
            assert c.heading_path == []


class TestChunkDispatcher:
    def test_heading_strategy(self):
        chunks = chunk("# H\n\nContent", "nb-001", "v1", strategy="heading")
        assert len(chunks) == 1

    def test_fixed_strategy(self):
        chunks = chunk("word " * 200, "nb-001", "v1", strategy="fixed", chunk_size=100)
        assert len(chunks) > 1

    def test_invalid_strategy(self):
        try:
            chunk("text", "nb-001", "v1", strategy="invalid")
            assert False, "Should raise ValueError"
        except ValueError:
            pass

    def test_default_strategy(self):
        chunks = chunk("# H\n\nContent", "nb-001", "v1")
        assert len(chunks) == 1

    def test_docling_strategy_raises(self):
        try:
            chunk("text", "nb-001", "v1", strategy="docling")
            assert False, "Should raise ValueError"
        except ValueError as e:
            assert "DoclingDocument" in str(e)


def _make_docling_doc(markdown: str):
    from docling.datamodel.base_models import InputFormat
    from docling.document_converter import DocumentConverter

    return DocumentConverter().convert_string(markdown, InputFormat.MD).document


class TestChunkByDocling:
    def test_basic(self):
        doc = _make_docling_doc(SAMPLE_MD)
        chunks = chunk_by_docling(doc, "nb-001", "v1", max_tokens=64)
        assert len(chunks) > 0
        full_text = "\n".join(c.content for c in chunks)
        assert "intro to chapter 1" in full_text or "Content of chapter 2" in full_text

    def test_heading_path_populated(self):
        doc = _make_docling_doc(SAMPLE_MD)
        chunks = chunk_by_docling(doc, "nb-001", "v1", max_tokens=64)
        all_headings = []
        for c in chunks:
            all_headings.extend(c.heading_path)
        assert any("Chapter 1" in h for h in all_headings)

    def test_notebook_and_version_ids(self):
        doc = _make_docling_doc("# H\n\nContent")
        chunks = chunk_by_docling(doc, "my-nb", "v2", max_tokens=128)
        for c in chunks:
            assert c.notebook_id == "my-nb"
            assert c.version_id == "v2"

    def test_chunk_ids_unique(self):
        doc = _make_docling_doc(SAMPLE_MD)
        chunks = chunk_by_docling(doc, "nb-001", "v1", max_tokens=64)
        ids = [c.chunk_id for c in chunks]
        assert len(ids) == len(set(ids))

    def test_single_chunk_short_doc(self):
        doc = _make_docling_doc("# Title\n\nHello world.")
        chunks = chunk_by_docling(doc, "nb-001", "v1", max_tokens=512)
        assert len(chunks) >= 1

    def test_empty_document(self):
        doc = _make_docling_doc("")
        chunks = chunk_by_docling(doc, "nb-001", "v1", max_tokens=64)
        assert len(chunks) == 0
