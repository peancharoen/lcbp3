# File: tests/unit/ocr-sidecar/test_residency_wiring.py
# Change Log:
# - 2026-06-20: Added ADR-040 residency wiring tests for process_ocr.
# - 2026-06-20: Updated for async process_ocr (Phase 6 — async I/O refactor).

import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from test_path_traversal import load_app


class FakeAsyncResponse:
    """จำลอง httpx.AsyncClient response สำหรับ async process_ocr"""

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return {"choices": [{"message": {"content": "{\"natural_text\": \"ok\"}"}}]}


class FakeAsyncClient:
    """จำลอง httpx.AsyncClient สำหรับ async process_ocr"""

    def __init__(self, *args, **kwargs) -> None:
        self.payload = None
        FakeAsyncClient.last_payload = None

    async def post(self, url: str, json: dict, headers: dict) -> FakeAsyncResponse:
        self.payload = json
        FakeAsyncClient.last_payload = json
        return FakeAsyncResponse()

    async def aclose(self) -> None:
        pass


FakeAsyncClient.last_payload = None


def test_process_ocr_uses_calculated_residency_keep_alive(tmp_path: Path) -> None:
    """T019: process_ocr ต้องเรียก calculate_ocr_residency และใช้ค่า keep_alive ที่คำนวณได้"""
    app_module = load_app(tmp_path)
    decision = SimpleNamespace(keep_alive_seconds=120, reason="headroom-sufficient", vram_headroom_mb=9000.0)
    fake_client = FakeAsyncClient()
    with patch.object(app_module, "calculate_ocr_residency", return_value=decision) as calculate, \
         patch.object(app_module, "prepare_ocr_messages", return_value=[{"content": []}]), \
         patch.object(app_module, "ollama_client", fake_client):
        result = asyncio.run(app_module.process_ocr("/tmp/test.pdf", page_num=1))
    assert result == "ok"
    calculate.assert_called_once_with(app_module.OCR_ACTIVE_PROFILE)
    assert FakeAsyncClient.last_payload["keep_alive"] == 120


def test_process_ocr_rejects_backend_keep_alive_override(tmp_path: Path) -> None:
    """T021: process_ocr ต้องปฏิเสธ keep_alive จาก backend"""
    app_module = load_app(tmp_path)

    async def run_test():
        with pytest.raises(ValueError, match="keep_alive must be calculated"):
            await app_module.process_ocr("/tmp/test.pdf", options_override={"keep_alive": 0})

    asyncio.run(run_test())


def test_ocr_endpoint_rejects_keep_alive_override(tmp_path: Path) -> None:
    """T021: /ocr endpoint ต้องปฏิเสธ keep_alive ใน request body"""
    app_module = load_app(tmp_path)
    from fastapi.testclient import TestClient

    client = TestClient(app_module.app)
    response = client.post(
        "/ocr",
        json={"pdfPath": str(tmp_path / "document.pdf"), "keep_alive": 0},
        headers={"X-API-Key": "test-key"},
    )
    assert response.status_code == 400
