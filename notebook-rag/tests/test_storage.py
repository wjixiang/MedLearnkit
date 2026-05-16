from datetime import datetime

from lib.models import EmbeddingVersion, NotebookMeta
from lib.storage import Storage


def _now():
    return datetime(2025, 1, 1, 0, 0, 0)


def _make_meta(nb_id="nb-001", name="test.pdf", stype="pdf"):
    return NotebookMeta(
        notebook_id=nb_id,
        source_name=name,
        source_type=stype,
        created_at=_now(),
        updated_at=_now(),
    )


def _make_version(vid="v1"):
    return EmbeddingVersion(
        version_id=vid,
        model="text-embedding-3-small",
        chunk_size=512,
        chunk_overlap=64,
        chunk_strategy="heading",
        created_at=_now(),
        chunk_count=10,
        dimension=1536,
    )


class TestMeta:
    def setup_method(self):
        self.storage = Storage(scheme="memory")

    def test_write_and_read_meta(self):
        meta = _make_meta()
        self.storage.write_meta("nb-001", meta)
        result = self.storage.read_meta("nb-001")
        assert result == meta
        assert result.notebook_id == "nb-001"

    def test_read_meta_not_found(self):
        import pytest
        with pytest.raises(Exception):
            self.storage.read_meta("nonexistent")


class TestSource:
    def setup_method(self):
        self.storage = Storage(scheme="memory")

    def test_write_and_read_source(self):
        self.storage.write_source("nb-001", b"pdf-content", "pdf")
        data, ext = self.storage.read_source("nb-001")
        assert data == b"pdf-content"
        assert ext == "pdf"

    def test_read_source_not_found(self):
        import pytest
        with pytest.raises(FileNotFoundError):
            self.storage.read_source("nb-001")


class TestImage:
    def setup_method(self):
        self.storage = Storage(scheme="memory")

    def test_write_and_read_image(self):
        self.storage.write_image("nb-001", "abc123", b"img-data", "png")
        data, ext = self.storage.read_image("nb-001", "abc123")
        assert data == b"img-data"
        assert ext == "png"

    def test_read_image_not_found(self):
        import pytest
        with pytest.raises(FileNotFoundError):
            self.storage.read_image("nb-001", "nonexistent")


class TestMarkdown:
    def setup_method(self):
        self.storage = Storage(scheme="memory")

    def test_write_and_read_markdown(self):
        content = "# Hello\n\nWorld content here."
        self.storage.write_markdown("nb-001", content)
        result = self.storage.read_markdown("nb-001")
        assert result == content


class TestVersions:
    def setup_method(self):
        self.storage = Storage(scheme="memory")

    def test_write_and_read_versions(self):
        versions = [_make_version("v1"), _make_version("v2")]
        self.storage.write_versions("nb-001", versions)
        result = self.storage.read_versions("nb-001")
        assert len(result) == 2
        assert result[0].version_id == "v1"

    def test_write_and_read_version_config(self):
        config = _make_version("v1")
        self.storage.write_version_config("nb-001", "v1", config)
        result = self.storage.read_version_config("nb-001", "v1")
        assert result.version_id == "v1"
        assert result.model == "text-embedding-3-small"


class TestLanceTableUri:
    def setup_method(self):
        self.storage = Storage(scheme="memory")

    def test_lance_table_uri(self):
        uri = self.storage.lance_table_uri("nb-001", "v1")
        assert uri == "notebooks/nb-001/embedding/v1/vectors.lance"


class TestListAndDelete:
    def setup_method(self):
        self.storage = Storage(scheme="memory")

    def test_list_notebooks_empty(self):
        result = self.storage.list_notebooks()
        assert result == []

    def test_list_notebooks(self):
        self.storage.write_meta("nb-001", _make_meta("nb-001"))
        self.storage.write_meta("nb-002", _make_meta("nb-002"))
        result = self.storage.list_notebooks()
        assert result == ["nb-001", "nb-002"]

    def test_delete_notebook(self):
        self.storage.write_meta("nb-001", _make_meta("nb-001"))
        self.storage.write_markdown("nb-001", "content")
        self.storage.delete_notebook("nb-001")
        assert self.storage.list_notebooks() == []

    def test_delete_version(self):
        self.storage.write_meta("nb-001", _make_meta("nb-001"))
        config = _make_version("v1")
        self.storage.write_version_config("nb-001", "v1", config)
        self.storage.delete_version("nb-001", "v1")
        assert self.storage.read_meta("nb-001") is not None
        import pytest
        with pytest.raises(Exception):
            self.storage.read_version_config("nb-001", "v1")


class TestStorageFromEnv:
    def test_from_env_defaults(self, monkeypatch):
        monkeypatch.setenv("OPENDAL_SCHEME", "memory")
        monkeypatch.delenv("OPENDAL_ROOT", raising=False)
        monkeypatch.delenv("OPENDAL_S3_BUCKET", raising=False)
        storage = Storage.from_env()
        assert storage is not None
        storage.write_meta("env-test", _make_meta("env-test"))
        result = storage.read_meta("env-test")
        assert result.notebook_id == "env-test"

    def test_from_env_s3_params(self, monkeypatch):
        monkeypatch.setenv("OPENDAL_SCHEME", "memory")
        monkeypatch.setenv("OPENDAL_S3_BUCKET", "my-bucket")
        monkeypatch.setenv("OPENDAL_S3_REGION", "us-east-1")
        monkeypatch.setenv("OPENDAL_S3_ENDPOINT", "https://s3.example.com")
        monkeypatch.setenv("OPENDAL_S3_ACCESS_KEY_ID", "key-id")
        monkeypatch.setenv("OPENDAL_S3_SECRET_ACCESS_KEY", "secret")
        storage = Storage.from_env()
        assert storage is not None

    def test_from_env_extra_params(self, monkeypatch):
        monkeypatch.setenv("OPENDAL_SCHEME", "memory")
        monkeypatch.setenv("OPENDAL_S3_CUSTOM_PARAM", "custom-value")
        storage = Storage.from_env()
        assert storage is not None

    def test_from_env_oss_params(self, monkeypatch):
        monkeypatch.setenv("OPENDAL_SCHEME", "memory")
        monkeypatch.setenv("OPENDAL_OSS_BUCKET", "oss-bucket")
        monkeypatch.setenv("OPENDAL_OSS_REGION", "oss-cn-hangzhou")
        storage = Storage.from_env()
        assert storage is not None

    def test_from_env_obs_params(self, monkeypatch):
        monkeypatch.setenv("OPENDAL_SCHEME", "memory")
        monkeypatch.setenv("OPENDAL_OBS_BUCKET", "obs-bucket")
        monkeypatch.setenv("OPENDAL_OBS_REGION", "cn-north-4")
        storage = Storage.from_env()
        assert storage is not None

    def test_from_env_cos_params(self, monkeypatch):
        monkeypatch.setenv("OPENDAL_SCHEME", "memory")
        monkeypatch.setenv("OPENDAL_COS_BUCKET", "cos-bucket")
        monkeypatch.setenv("OPENDAL_COS_REGION", "ap-guangzhou")
        storage = Storage.from_env()
        assert storage is not None
