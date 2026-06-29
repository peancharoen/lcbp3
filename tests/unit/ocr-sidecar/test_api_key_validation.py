# File: tests/unit/ocr-sidecar/test_api_key_validation.py
# Change Log:
# - 2026-06-20: Added ADR-040 API key startup and request validation tests.

import importlib
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from test_path_traversal import SIDECAR_DIR, install_import_stubs, load_app


def test_sidecar_fails_fast_when_api_key_missing(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    install_import_stubs()
    monkeypatch.delenv("OCR_SIDECAR_API_KEY", raising=False)
    monkeypatch.setenv("OCR_SIDECAR_UPLOAD_BASE", str(tmp_path))
    if str(SIDECAR_DIR) not in sys.path:
        sys.path.insert(0, str(SIDECAR_DIR))
    sys.modules.pop("app", None)
    with pytest.raises(RuntimeError, match="OCR_SIDECAR_API_KEY is required"):
        importlib.import_module("app")


def test_sidecar_rejects_invalid_api_key(tmp_path: Path) -> None:
    app_module = load_app(tmp_path)
    client = TestClient(app_module.app)
    response = client.post(
        "/embed",
        json={"text": "hello"},
        headers={"X-API-Key": "wrong-key"},
    )
    assert response.status_code == 401


def test_sidecar_rejects_missing_api_key(tmp_path: Path) -> None:
    app_module = load_app(tmp_path)
    client = TestClient(app_module.app)
    response = client.post("/embed", json={"text": "hello"})
    assert response.status_code == 401
