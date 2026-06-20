# File: tests/unit/ocr-sidecar/test_path_traversal.py
# Change Log:
# - 2026-06-20: Added ADR-040 path traversal tests for OCR sidecar.

import importlib
import os
import sys
import types
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

SIDECAR_DIR = Path(__file__).resolve().parents[3] / "specs" / "04-Infrastructure-OPS" / "04-00-docker-compose" / "Desk-5439" / "ocr-sidecar"


def install_import_stubs() -> None:
    """ติดตั้ง stub สำหรับ dependency หนักเพื่อให้ unit test import app ได้เร็ว"""
    fitz_module = types.ModuleType("fitz")
    fitz_module.Document = object
    fitz_module.open = lambda *args, **kwargs: None
    sys.modules["fitz"] = fitz_module
    typhoon_module = types.ModuleType("typhoon_ocr")
    typhoon_module.prepare_ocr_messages = lambda *args, **kwargs: [{"content": []}]
    sys.modules["typhoon_ocr"] = typhoon_module
    flag_module = types.ModuleType("FlagEmbedding")
    flag_module.BGEM3FlagModel = lambda *args, **kwargs: None
    flag_module.FlagReranker = lambda *args, **kwargs: None
    sys.modules["FlagEmbedding"] = flag_module
    pil_module = types.ModuleType("PIL")
    pil_image_module = types.ModuleType("PIL.Image")
    pil_module.Image = pil_image_module
    sys.modules["PIL"] = pil_module
    sys.modules["PIL.Image"] = pil_image_module
    pythainlp_module = types.ModuleType("pythainlp")
    tokenize_module = types.ModuleType("pythainlp.tokenize")
    tokenize_module.word_tokenize = lambda text, **kwargs: text.split()
    util_module = types.ModuleType("pythainlp.util")
    util_module.normalize = lambda text: text
    sys.modules["pythainlp"] = pythainlp_module
    sys.modules["pythainlp.tokenize"] = tokenize_module
    sys.modules["pythainlp.util"] = util_module


def load_app(upload_base: Path):
    install_import_stubs()
    os.environ["OCR_SIDECAR_API_KEY"] = "test-key"
    os.environ["OCR_SIDECAR_UPLOAD_BASE"] = str(upload_base)
    if str(SIDECAR_DIR) not in sys.path:
        sys.path.insert(0, str(SIDECAR_DIR))
    sys.modules.pop("app", None)
    return importlib.import_module("app")


class FakePage:
    def get_text(self) -> str:
        return "A" * 120


class FakeDocument:
    name = "fake.pdf"

    def __len__(self) -> int:
        return 1

    def __getitem__(self, index: int) -> FakePage:
        return FakePage()


def test_ocr_rejects_parent_traversal_outside_upload_base(tmp_path: Path) -> None:
    upload_base = tmp_path / "uploads"
    upload_base.mkdir()
    app_module = load_app(upload_base)
    client = TestClient(app_module.app)
    outside_path = upload_base / ".." / "outside.pdf"
    response = client.post(
        "/ocr",
        json={"pdfPath": str(outside_path)},
        headers={"X-API-Key": "test-key"},
    )
    assert response.status_code == 403


def test_ocr_rejects_prefix_sibling_path(tmp_path: Path) -> None:
    upload_base = tmp_path / "uploads"
    sibling = tmp_path / "uploads_evil"
    upload_base.mkdir()
    sibling.mkdir()
    app_module = load_app(upload_base)
    client = TestClient(app_module.app)
    response = client.post(
        "/ocr",
        json={"pdfPath": str(sibling / "document.pdf")},
        headers={"X-API-Key": "test-key"},
    )
    assert response.status_code == 403


def test_ocr_accepts_canonical_path_inside_upload_base(tmp_path: Path) -> None:
    upload_base = tmp_path / "uploads"
    upload_base.mkdir()
    pdf_path = upload_base / "document.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n")
    app_module = load_app(upload_base)
    client = TestClient(app_module.app)
    with patch.object(app_module.fitz, "open", return_value=FakeDocument()):
        response = client.post(
            "/ocr",
            json={"pdfPath": str(pdf_path)},
            headers={"X-API-Key": "test-key"},
        )
    assert response.status_code == 200
    assert response.json()["engineUsed"] == "fast-path"

