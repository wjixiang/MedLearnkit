import json
import os

import opendal

from lib.models import EmbeddingVersion, NotebookMeta

_SCHEME_ENV_MAP: dict[str, dict[str, str]] = {
    "s3": {
        "bucket": "OPENDAL_S3_BUCKET",
        "region": "OPENDAL_S3_REGION",
        "endpoint": "OPENDAL_S3_ENDPOINT",
        "access_key_id": "OPENDAL_S3_ACCESS_KEY_ID",
        "secret_access_key": "OPENDAL_S3_SECRET_ACCESS_KEY",
    },
    "gcs": {
        "bucket": "OPENDAL_GCS_BUCKET",
        "credential_path": "OPENDAL_GCS_CREDENTIAL_PATH",
    },
    "azblob": {
        "container": "OPENDAL_AZBLOB_CONTAINER",
        "credential": "OPENDAL_AZBLOB_CREDENTIAL",
        "endpoint": "OPENDAL_AZBLOB_ENDPOINT",
    },
    "obs": {
        "bucket": "OPENDAL_OBS_BUCKET",
        "region": "OPENDAL_OBS_REGION",
        "access_key_id": "OPENDAL_OBS_ACCESS_KEY_ID",
        "secret_access_key": "OPENDAL_OBS_SECRET_ACCESS_KEY",
        "endpoint": "OPENDAL_OBS_ENDPOINT",
    },
    "cos": {
        "bucket": "OPENDAL_COS_BUCKET",
        "region": "OPENDAL_COS_REGION",
        "secret_id": "OPENDAL_COS_SECRET_ID",
        "secret_key": "OPENDAL_COS_SECRET_KEY",
        "endpoint": "OPENDAL_COS_ENDPOINT",
    },
    "oss": {
        "bucket": "OPENDAL_OSS_BUCKET",
        "region": "OPENDAL_OSS_REGION",
        "access_key_id": "OPENDAL_OSS_ACCESS_KEY_ID",
        "access_key_secret": "OPENDAL_OSS_ACCESS_KEY_SECRET",
        "endpoint": "OPENDAL_OSS_ENDPOINT",
    },
}


class Storage:
    def __init__(self, scheme: str = "memory", root: str = "", **options):
        self._op = opendal.Operator(scheme, root=root, **options)

    @property
    def operator(self) -> opendal.Operator:
        return self._op

    @classmethod
    def from_env(cls) -> "Storage":
        scheme = os.getenv("OPENDAL_SCHEME", "fs")
        root = os.getenv("OPENDAL_ROOT", "")
        options: dict[str, str] = {}

        env_map = _SCHEME_ENV_MAP.get(scheme, {})
        for opendal_key, env_key in env_map.items():
            val = os.getenv(env_key)
            if val:
                options[opendal_key] = val

        extra_prefix = f"OPENDAL_{scheme.upper()}_"
        for key, val in os.environ.items():
            if key.startswith(extra_prefix) and key not in env_map.values():
                param_name = key[len(extra_prefix):].lower()
                if param_name not in options:
                    options[param_name] = val

        if scheme == "fs" and not root:
            root = "./notebooks"

        return cls(scheme=scheme, root=root, **options)

    def _nb_prefix(self, notebook_id: str) -> str:
        return f"notebooks/{notebook_id}/"

    def write_meta(self, notebook_id: str, meta: NotebookMeta) -> None:
        path = f"{self._nb_prefix(notebook_id)}meta.json"
        self._op.write(path, meta.model_dump_json().encode())

    def read_meta(self, notebook_id: str) -> NotebookMeta:
        path = f"{self._nb_prefix(notebook_id)}meta.json"
        data = self._op.read(path)
        return NotebookMeta.model_validate_json(data)

    def write_source(self, notebook_id: str, data: bytes, ext: str) -> None:
        path = f"{self._nb_prefix(notebook_id)}raw/source.{ext}"
        self._op.write(path, data)

    def read_source(self, notebook_id: str) -> tuple[bytes, str]:
        list_prefix = f"{self._nb_prefix(notebook_id)}raw/"
        for entry in self._op.list(list_prefix):
            path = entry.path if hasattr(entry, "path") else entry
            basename = path[len(list_prefix):]
            if basename.startswith("source"):
                data = self._op.read(path)
                ext = basename.rsplit(".", 1)[-1] if "." in basename else ""
                return data, ext
        raise FileNotFoundError(f"source not found for notebook {notebook_id}")

    def write_image(self, notebook_id: str, hash_key: str, data: bytes, ext: str) -> None:
        path = f"{self._nb_prefix(notebook_id)}raw/images/{hash_key}.{ext}"
        self._op.write(path, data)

    def read_image(self, notebook_id: str, hash_key: str) -> tuple[bytes, str]:
        list_prefix = f"{self._nb_prefix(notebook_id)}raw/images/"
        for entry in self._op.list(list_prefix):
            path = entry.path if hasattr(entry, "path") else entry
            basename = path[len(list_prefix):]
            if basename.startswith(hash_key):
                data = self._op.read(path)
                ext = basename.rsplit(".", 1)[-1] if "." in basename else ""
                return data, ext
        raise FileNotFoundError(f"image {hash_key} not found for notebook {notebook_id}")

    def write_markdown(self, notebook_id: str, content: str) -> None:
        path = f"{self._nb_prefix(notebook_id)}raw/markdown.md"
        self._op.write(path, content.encode())

    def read_markdown(self, notebook_id: str) -> str:
        path = f"{self._nb_prefix(notebook_id)}raw/markdown.md"
        return self._op.read(path).decode()

    def write_versions(self, notebook_id: str, versions: list[EmbeddingVersion]) -> None:
        path = f"{self._nb_prefix(notebook_id)}embedding/versions.json"
        data = [v.model_dump() for v in versions]
        self._op.write(path, json.dumps(data, default=str).encode())

    def read_versions(self, notebook_id: str) -> list[EmbeddingVersion]:
        path = f"{self._nb_prefix(notebook_id)}embedding/versions.json"
        raw = self._op.read(path)
        items = json.loads(raw)
        return [EmbeddingVersion.model_validate(item) for item in items]

    def write_version_config(
        self, notebook_id: str, version_id: str, config: EmbeddingVersion
    ) -> None:
        path = f"{self._nb_prefix(notebook_id)}embedding/{version_id}/config.json"
        self._op.write(path, config.model_dump_json().encode())

    def read_version_config(
        self, notebook_id: str, version_id: str
    ) -> EmbeddingVersion:
        path = f"{self._nb_prefix(notebook_id)}embedding/{version_id}/config.json"
        data = self._op.read(path)
        return EmbeddingVersion.model_validate_json(data)

    def lance_table_uri(self, notebook_id: str, version_id: str) -> str:
        return f"{self._nb_prefix(notebook_id)}embedding/{version_id}/vectors.lance"

    def list_notebooks(self) -> list[str]:
        result = []
        try:
            for entry in self._op.list("notebooks/"):
                path = entry.path if hasattr(entry, "path") else entry
                if path.endswith("/"):
                    nb_id = path.rstrip("/")
                    nb_id = nb_id.split("/")[-1]
                    if nb_id and nb_id != "notebooks":
                        result.append(nb_id)
        except Exception:
            pass
        return sorted(result)

    def delete_notebook(self, notebook_id: str) -> None:
        path = self._nb_prefix(notebook_id)
        self._op.remove_all(path)

    def delete_version(self, notebook_id: str, version_id: str) -> None:
        path = f"{self._nb_prefix(notebook_id)}embedding/{version_id}/"
        self._op.remove_all(path)

    def write_docling_doc(self, notebook_id: str, docling_doc) -> None:
        path = f"{self._nb_prefix(notebook_id)}raw/docling_doc.json"
        doc_dict = docling_doc.model_dump()
        self._op.write(path, json.dumps(doc_dict, ensure_ascii=False, default=str).encode())

    def read_docling_doc(self, notebook_id: str):
        try:
            path = f"{self._nb_prefix(notebook_id)}raw/docling_doc.json"
            data = self._op.read(path)
            from docling_core.types.doc import DoclingDocument

            doc_dict = json.loads(data)
            return DoclingDocument.model_validate(doc_dict)
        except Exception:
            return None
