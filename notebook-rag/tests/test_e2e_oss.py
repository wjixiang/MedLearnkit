import os
import shutil

import pytest

from lib.storage import Storage
from lib.models import NotebookMeta, EmbeddingVersion
from lib.embedder import Embedder
from lib.chunker import chunk
from lib.vector_store import VectorStore
from lib.service import NotebookService
from datetime import datetime, timezone


NB_ID = "_e2e_oss_test"
NB_ID_2 = "_e2e_oss_test_2"
NB_ID_3 = "_e2e_oss_del_test"
SAMPLE_MARKDOWN = """# 机器学习简介

机器学习是人工智能的一个重要分支。

## 监督学习

监督学习使用带标签的数据进行训练，常见的算法包括线性回归、决策树等。

## 无监督学习

无监督学习使用无标签的数据，主要用于聚类和降维等任务。

### K-Means 聚类

K-Means 是最常用的聚类算法之一。
"""


@pytest.fixture(scope="module")
def oss_storage():
    s = Storage.from_env()
    for nb in [NB_ID, NB_ID_2, NB_ID_3]:
        try:
            s.delete_notebook(nb)
        except Exception:
            pass
    yield s
    for nb in [NB_ID, NB_ID_2, NB_ID_3]:
        try:
            s.delete_notebook(nb)
        except Exception:
            pass
    try:
        s.delete_notebook(NB_ID_3)
    except Exception:
        pass


@pytest.fixture(scope="module")
def lance_dir(tmp_path_factory):
    d = tmp_path_factory.mktemp("lance_oss_e2e")
    yield str(d)
    shutil.rmtree(str(d), ignore_errors=True)


class TestOSSStorageBasic:
    def test_write_and_read_meta(self, oss_storage):
        now = datetime.now(timezone.utc)
        meta = NotebookMeta(
            notebook_id=NB_ID, source_name="test.pdf", source_type="pdf",
            created_at=now, updated_at=now,
        )
        oss_storage.write_meta(NB_ID, meta)
        result = oss_storage.read_meta(NB_ID)
        assert result.notebook_id == NB_ID
        assert result.source_name == "test.pdf"

    def test_write_and_read_markdown(self, oss_storage):
        oss_storage.write_markdown(NB_ID, SAMPLE_MARKDOWN)
        result = oss_storage.read_markdown(NB_ID)
        assert "机器学习" in result
        assert "监督学习" in result

    def test_write_and_read_source(self, oss_storage):
        oss_storage.write_source(NB_ID, b"fake-pdf-bytes", "pdf")
        data, ext = oss_storage.read_source(NB_ID)
        assert data == b"fake-pdf-bytes"
        assert ext == "pdf"

    def test_write_and_read_image(self, oss_storage):
        oss_storage.write_image(NB_ID, "img001", b"\x89PNGFAKE", "png")
        data, ext = oss_storage.read_image(NB_ID, "img001")
        assert data == b"\x89PNGFAKE"
        assert ext == "png"

    def test_write_and_read_versions(self, oss_storage):
        now = datetime.now(timezone.utc)
        versions = [
            EmbeddingVersion(
                version_id="v1", model="text-embedding-v4", chunk_size=512,
                chunk_overlap=64, chunk_strategy="heading", created_at=now,
                chunk_count=5, dimension=1024,
            ),
        ]
        oss_storage.write_versions(NB_ID, versions)
        result = oss_storage.read_versions(NB_ID)
        assert len(result) == 1
        assert result[0].version_id == "v1"

    def test_list_notebooks(self, oss_storage):
        oss_storage.write_meta(NB_ID, NotebookMeta(
            notebook_id=NB_ID, source_name="a.pdf", source_type="pdf",
            created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
        ))
        oss_storage.write_meta(NB_ID_2, NotebookMeta(
            notebook_id=NB_ID_2, source_name="b.docx", source_type="docx",
            created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
        ))
        result = oss_storage.list_notebooks()
        assert NB_ID in result
        assert NB_ID_2 in result

    def test_delete_notebook(self, oss_storage):
        oss_storage.write_meta(NB_ID, NotebookMeta(
            notebook_id=NB_ID, source_name="del.pdf", source_type="pdf",
            created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
        ))
        oss_storage.delete_notebook(NB_ID)
        assert NB_ID not in oss_storage.list_notebooks()

    def test_delete_version_removes_config(self, oss_storage):
        now = datetime.now(timezone.utc)
        v = EmbeddingVersion(
            version_id="v_del", model="m", chunk_size=512, chunk_overlap=64,
            chunk_strategy="heading", created_at=now, chunk_count=1, dimension=1024,
        )
        oss_storage.write_version_config(NB_ID_3, "v_del", v)
        oss_storage.delete_version(NB_ID_3, "v_del")
        import pytest
        with pytest.raises(Exception):
            oss_storage.read_version_config(NB_ID_3, "v_del")


class TestOSSFullPipeline:
    def test_convert_embed_query_via_service(self, oss_storage, lance_dir):
        embedder = Embedder()
        svc = NotebookService(oss_storage, embedder=embedder, lance_db_uri=lance_dir)

        oss_storage.write_markdown(NB_ID, SAMPLE_MARKDOWN)
        oss_storage.write_meta(NB_ID, NotebookMeta(
            notebook_id=NB_ID, source_name="ml.pdf", source_type="pdf",
            created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
        ))

        version = svc.embed(NB_ID, chunk_strategy="heading")
        assert version.version_id is not None
        assert version.model == "text-embedding-v4"
        assert version.chunk_count > 0
        assert version.dimension == 1024

        versions = svc.list_versions(NB_ID)
        assert len(versions) == 1

        results = svc.query(NB_ID, "什么是监督学习？")
        assert len(results) > 0
        assert any("监督学习" in r.content for r in results)

    def test_multi_version_query(self, oss_storage, lance_dir):
        embedder = Embedder()
        svc = NotebookService(oss_storage, embedder=embedder, lance_db_uri=lance_dir)

        oss_storage.write_markdown(NB_ID_2, "# 测试\n\n段落一\n\n## 第二节\n\n段落二")
        oss_storage.write_meta(NB_ID_2, NotebookMeta(
            notebook_id=NB_ID_2, source_name="test.md", source_type="md",
            created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
        ))

        v1 = svc.embed(NB_ID_2, chunk_strategy="heading")
        v2 = svc.embed(NB_ID_2, chunk_strategy="fixed", chunk_size=50)

        versions = svc.list_versions(NB_ID_2)
        assert len(versions) == 2

        r1 = svc.query(NB_ID_2, "测试", version_id=v1.version_id)
        r2 = svc.query(NB_ID_2, "测试", version_id=v2.version_id)
        assert len(r1) > 0
        assert len(r2) > 0

        svc.delete_version(NB_ID_2, v1.version_id)
        remaining = svc.list_versions(NB_ID_2)
        assert len(remaining) == 1
        assert remaining[0].version_id == v2.version_id
