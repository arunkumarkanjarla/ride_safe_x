"""Filesystem storage abstraction (no object-store / MinIO)."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

SAFE_KEY_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,250}$")


class StorageError(ValueError):
    """Invalid storage key or path."""


class FileSystemStorage:
    """Store blobs under a configured root using generated keys."""

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()

    def ensure_root(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def generate_key(self, *, prefix: str = "uploads", suffix: str = "") -> str:
        safe_prefix = re.sub(r"[^a-zA-Z0-9/_-]", "", prefix).strip("/") or "uploads"
        name = uuid.uuid4().hex
        if suffix:
            clean = re.sub(r"[^a-zA-Z0-9.]", "", suffix)
            if clean and not clean.startswith("."):
                clean = f".{clean}"
            name = f"{name}{clean}"
        return f"{safe_prefix}/{name}"

    def resolve(self, key: str) -> Path:
        if not key or key.startswith("/") or "\\" in key:
            raise StorageError("invalid storage key")
        if ".." in key.split("/"):
            raise StorageError("path traversal rejected")
        if not SAFE_KEY_RE.match(key):
            raise StorageError("invalid storage key characters")
        path = (self.root / key).resolve()
        try:
            path.relative_to(self.root)
        except ValueError as exc:
            raise StorageError("path escapes storage root") from exc
        return path

    def write_bytes(self, key: str, data: bytes) -> Path:
        path = self.resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def read_bytes(self, key: str) -> bytes:
        path = self.resolve(key)
        if not path.is_file():
            raise FileNotFoundError(key)
        return path.read_bytes()

    def delete(self, key: str) -> None:
        path = self.resolve(key)
        if path.is_file():
            path.unlink()
