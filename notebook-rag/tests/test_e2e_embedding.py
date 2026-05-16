import os
import shutil

import pytest
import numpy as np

from lib.embedder import Embedder
from lib.storage import Storage
from lib.chunker import chunk
from lib.vector_store import VectorStore
from lib.service import NotebookService


@pytest.fixture(scope="module")
def embedder():
    emb = Embedder()
    yield emb


@pytest.fixture(scope="module")
def lance_dir(tmp_path_factory):
    d = tmp_path_factory.mktemp("lance_e2e")
    yield str(d)
    shutil.rmtree(str(d), ignore_errors=True)


class TestEmbedSingle:
    def test_single_text_returns_vector(self, embedder):
        result = embedder.embed_query("什么是机器学习？")
        assert isinstance(result, list)
        assert len(result) > 0
        assert all(isinstance(x, float) for x in result)

    def test_single_text_dimension(self, embedder):
        result = embedder.embed_query("你好世界")
        assert len(result) == 1024

    def test_single_text_not_all_zeros(self, embedder):
        result = embedder.embed_query("这是一段测试文本")
        assert not all(x == 0.0 for x in result)

    def test_different_texts_different_vectors(self, embedder):
        v1 = embedder.embed_query("人工智能是计算机科学的一个分支")
        v2 = embedder.embed_query("今天天气很好适合出门散步")
        assert v1 != v2

    def test_similar_texts_higher_similarity(self, embedder):
        v1 = embedder.embed_query("机器学习是人工智能的核心技术")
        v2 = embedder.embed_query("深度学习是机器学习的一个重要方向")
        v3 = embedder.embed_query("红烧肉是一道经典的中国菜")

        def cosine(a, b):
            return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

        sim_related = cosine(v1, v2)
        sim_unrelated = cosine(v1, v3)
        assert sim_related > sim_unrelated


class TestEmbedBatch:
    def test_batch_returns_correct_count(self, embedder):
        texts = ["文本一", "文本二", "文本三"]
        results = embedder.embed_texts(texts)
        assert len(results) == 3
        for r in results:
            assert isinstance(r, list)
            assert len(r) == 1024

    def test_batch_empty(self, embedder):
        results = embedder.embed_texts([])
        assert results == []

    def test_batch_single(self, embedder):
        results = embedder.embed_texts(["只有一条"])
        assert len(results) == 1

    def test_batch_order_preserved(self, embedder):
        texts = ["苹果是一种水果", "香蕉是黄色的", "猫是一种动物"]
        results = embedder.embed_texts(texts)
        direct_0 = embedder.embed_query("苹果是一种水果")
        direct_2 = embedder.embed_query("猫是一种动物")

        def cosine(a, b):
            return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

        assert cosine(results[0], direct_0) > 0.999
        assert cosine(results[2], direct_2) > 0.999

    def test_batch_max_size_10(self, embedder):
        texts = [f"第{i}条文本用于测试批量嵌入" for i in range(10)]
        results = embedder.embed_texts(texts)
        assert len(results) == 10


class TestEmbedViaService:
    def test_embed_service_e2e(self, lance_dir):
        storage = Storage(scheme="memory")
        embedder = Embedder()
        svc = NotebookService(storage, embedder=embedder, lance_db_uri=lance_dir)

        nb_id = "e2e-embed-test"
        markdown = """# 机器学习简介

机器学习是人工智能的一个重要分支，它通过数据训练模型来做出预测或决策。

## 监督学习

监督学习使用带标签的数据进行训练，常见的算法包括线性回归、决策树等。

## 无监督学习

无监督学习使用无标签的数据，主要用于聚类和降维等任务。
"""
        storage.write_markdown(nb_id, markdown)

        version = svc.embed(nb_id, chunk_strategy="heading")
        assert version.version_id is not None
        assert version.model == "text-embedding-v4"
        assert version.chunk_count > 0
        assert version.dimension == 1024
        assert version.chunk_strategy == "heading"

        results = svc.query(nb_id, "什么是监督学习？")
        assert len(results) > 0
        assert any("监督学习" in r.content for r in results)

    def test_embed_fixed_strategy(self, lance_dir):
        storage = Storage(scheme="memory")
        embedder = Embedder()
        svc = NotebookService(storage, embedder=embedder, lance_db_uri=lance_dir)

        nb_id = "e2e-fixed-test"
        storage.write_markdown(nb_id, "这是一段测试文本。" * 100)

        version = svc.embed(nb_id, chunk_strategy="fixed", chunk_size=100, chunk_overlap=20)
        assert version.chunk_strategy == "fixed"
        assert version.chunk_count > 1

    def test_multi_version_embed(self, lance_dir):
        storage = Storage(scheme="memory")
        embedder = Embedder()
        svc = NotebookService(storage, embedder=embedder, lance_db_uri=lance_dir)

        nb_id = "e2e-multi-ver"
        storage.write_markdown(nb_id, "# 测试\n\n内容段落一\n\n## 第二节\n\n内容段落二")

        v1 = svc.embed(nb_id, chunk_strategy="heading")
        v2 = svc.embed(nb_id, chunk_strategy="fixed", chunk_size=50)

        versions = svc.list_versions(nb_id)
        assert len(versions) == 2
        assert versions[0].version_id == v1.version_id
        assert versions[1].version_id == v2.version_id

        r1 = svc.query(nb_id, "测试", version_id=v1.version_id)
        r2 = svc.query(nb_id, "测试", version_id=v2.version_id)
        assert len(r1) > 0
        assert len(r2) > 0
