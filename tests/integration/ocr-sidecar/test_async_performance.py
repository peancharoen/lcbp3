# File: tests/integration/ocr-sidecar/test_async_performance.py
# Change Log:
# - 2026-06-20: Added ADR-040 US4 async I/O performance tests for process_ocr and lifespan.

import asyncio
import inspect
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

UNIT_DIR = Path(__file__).resolve().parents[2] / "unit" / "ocr-sidecar"
if str(UNIT_DIR) not in sys.path:
    sys.path.insert(0, str(UNIT_DIR))

from test_path_traversal import load_app


class FakeAsyncResponse:
    """จำลอง httpx.AsyncClient response"""

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return {"choices": [{"message": {"content": '{"natural_text": "ok"}'}}]}


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


def test_process_ocr_is_coroutine_function(tmp_path: Path) -> None:
    """T042: process_ocr ต้องเป็น async def (coroutine function)"""
    app_module = load_app(tmp_path)
    assert inspect.iscoroutinefunction(app_module.process_ocr), (
        "process_ocr must be async def per ADR-040 US4"
    )


def test_process_pdf_doc_is_coroutine_function(tmp_path: Path) -> None:
    """T042: _process_pdf_doc ต้องเป็น async def เพราะเรียก process_ocr"""
    app_module = load_app(tmp_path)
    assert inspect.iscoroutinefunction(app_module._process_pdf_doc), (
        "_process_pdf_doc must be async def per ADR-040 US4"
    )


def test_app_uses_lifespan_not_startup_event(tmp_path: Path) -> None:
    """T045: app ต้องใช้ lifespan context manager ไม่ใช่ @app.on_event('startup')"""
    app_module = load_app(tmp_path)
    app_obj = app_module.app
    # FastAPI เก็บ lifespan ใน app.router.lifespan_context
    assert hasattr(app_obj.router, "lifespan_context"), (
        "App must use lifespan parameter, not @app.on_event('startup')"
    )
    # ตรวจสอบว่าไม่มี startup event handlers แบบเดิม
    startup_handlers = app_obj.router.on_startup
    assert len(startup_handlers) == 0, (
        "App must not register @app.on_event('startup') handlers"
    )


def test_app_has_async_client_global(tmp_path: Path) -> None:
    """T043: app module ต้องมี ollama_client global สำหรับ AsyncClient"""
    app_module = load_app(tmp_path)
    assert hasattr(app_module, "ollama_client"), (
        "app module must have ollama_client global for shared AsyncClient"
    )


def test_normalize_endpoint_removed(tmp_path: Path) -> None:
    """T054: /normalize endpoint ต้องถูกลบออกแล้ว"""
    app_module = load_app(tmp_path)
    routes = [r.path for r in app_module.app.routes]
    assert "/normalize" not in routes, (
        "/normalize endpoint must be removed per ADR-040 D2"
    )


def test_concurrent_ocr_requests_dont_block(tmp_path: Path) -> None:
    """T041: concurrent OCR requests ต้องไม่ block กัน (async I/O)"""
    app_module = load_app(tmp_path)

    decision = SimpleNamespace(
        keep_alive_seconds=60,
        reason="headroom-sufficient",
        vram_headroom_mb=9000.0,
    )

    fake_client = FakeAsyncClient()

    async def run_concurrent() -> list[str]:
        """รัน process_ocr 3 ครั้งพร้อมกัน วัดว่าไม่ block"""
        with (
            patch.object(app_module, "calculate_ocr_residency", return_value=decision),
            patch.object(app_module, "prepare_ocr_messages", return_value=[{"content": []}]),
            patch.object(app_module, "ollama_client", fake_client),
        ):
            tasks = [
                app_module.process_ocr("/tmp/test.pdf", page_num=i + 1)
                for i in range(3)
            ]
            results = await asyncio.gather(*tasks)
            return results

    results = asyncio.run(run_concurrent())
    assert len(results) == 3
    assert all(r == "ok" for r in results)
    # ทุก request ต้องส่ง payload ได้สำเร็จ
    assert FakeAsyncClient.last_payload is not None
    assert FakeAsyncClient.last_payload["keep_alive"] == 60
