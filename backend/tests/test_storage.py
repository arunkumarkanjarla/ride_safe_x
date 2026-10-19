"""Filesystem storage tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.storage import FileSystemStorage, StorageError


def test_write_read_roundtrip(tmp_path: Path) -> None:
    store = FileSystemStorage(tmp_path)
    store.ensure_root()
    key = store.generate_key(prefix="docs", suffix=".txt")
    store.write_bytes(key, b"hello-ridenova")
    assert store.read_bytes(key) == b"hello-ridenova"
    assert (tmp_path / key).is_file()


def test_rejects_path_traversal(tmp_path: Path) -> None:
    store = FileSystemStorage(tmp_path)
    with pytest.raises(StorageError):
        store.resolve("../etc/passwd")
    with pytest.raises(StorageError):
        store.resolve("a/../../b")
    with pytest.raises(StorageError):
        store.resolve("/absolute")
    with pytest.raises(StorageError):
        store.resolve("win\\path")


def test_rejects_user_supplied_unsafe_key(tmp_path: Path) -> None:
    store = FileSystemStorage(tmp_path)
    with pytest.raises(StorageError):
        store.write_bytes("bad key with spaces", b"x")


def test_generated_keys_are_safe(tmp_path: Path) -> None:
    store = FileSystemStorage(tmp_path)
    key = store.generate_key(prefix="kyc", suffix=".pdf")
    path = store.resolve(key)
    assert path.is_relative_to(tmp_path.resolve()) or str(path).startswith(
        str(tmp_path.resolve())
    )
