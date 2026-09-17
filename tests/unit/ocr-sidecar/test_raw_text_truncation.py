# File: tests/unit/ocr-sidecar/test_raw_text_truncation.py
# Change Log:
# - 2026-09-17: Regression tests สำหรับ OCR_RAW_TEXT_MAX_CHARS truncation —
#   PDF text layer เสีย (per-char position dump) ทำ prompt เกิน num_ctx 8192
#   → Ollama 400 → OCR ล้มทั้งเอกสาร (incident ผรม.2-คคง.-0020-2567)

import importlib
import os
import sys
import types
from pathlib import Path

SIDECAR_DIR = (
    Path(__file__).resolve().parents[3]
    / "specs"
    / "04-Infrastructure-OPS"
    / "04-00-docker-compose"
    / "np-dms-lcbp3"
    / "04-ai"
    / "ocr-sidecar"
)


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
    redis_module = types.ModuleType("redis")
    redis_asyncio_module = types.ModuleType("redis.asyncio")
    redis_module.asyncio = redis_asyncio_module
    sys.modules.setdefault("redis", redis_module)
    sys.modules.setdefault("redis.asyncio", redis_asyncio_module)


def load_app() -> types.ModuleType:
    install_import_stubs()
    os.environ["OCR_SIDECAR_UPLOAD_BASE"] = "/tmp"
    if str(SIDECAR_DIR) not in sys.path:
        sys.path.insert(0, str(SIDECAR_DIR))
    sys.modules.pop("app", None)
    return importlib.import_module("app")


def _build_prompt(raw_text: str) -> str:
    return f"HEADER\nRAW_TEXT_START\n{raw_text}\nRAW_TEXT_END\nFOOTER"


def test_truncate_oversized_raw_text() -> None:
    """RAW_TEXT ยาวเกินเพดานต้องถูกตัด — markers และส่วนอื่นของ prompt ต้องอยู่ครบ"""
    app_module = load_app()
    garbage = "[460x56]ส" * 1500  # ~12k chars เหมือน text layer เสียของจริง
    prompt = _build_prompt(garbage)
    result = app_module.truncate_raw_text_section(prompt)
    assert len(result) < len(prompt)
    assert "[truncated]" in result
    assert "RAW_TEXT_START" in result
    assert "RAW_TEXT_END" in result
    assert "FOOTER" in result
    # เนื้อหา raw text ที่เหลือต้องไม่เกินเพดาน
    start = result.index("RAW_TEXT_START") + len("RAW_TEXT_START")
    end = result.index("RAW_TEXT_END")
    assert len(result[start:end].strip()) <= app_module.OCR_RAW_TEXT_MAX_CHARS + 20


def test_truncate_short_raw_text_unchanged() -> None:
    """RAW_TEXT สั้น (ปกติ) ต้องไม่ถูกแตะ"""
    app_module = load_app()
    prompt = _build_prompt("เอกสารปกติ เลขที่ 123")
    assert app_module.truncate_raw_text_section(prompt) == prompt


def test_truncate_no_markers_passthrough() -> None:
    """prompt ที่ไม่มี markers ต้องผ่านไปตรง ๆ"""
    app_module = load_app()
    assert app_module.truncate_raw_text_section("plain prompt") == "plain prompt"


def test_strip_raw_text_for_prompt_hash() -> None:
    """strip_raw_text_section ต้องลบเฉพาะเนื้อหา คง markers ไว้ —
    ทำให้ prompt hash คงที่ข้ามหน้า (ไม่ force reload model ทุกหน้า)"""
    app_module = load_app()
    page1 = _build_prompt("text page one")
    page2 = _build_prompt("completely different page two content")
    stripped1 = app_module.strip_raw_text_section(page1)
    stripped2 = app_module.strip_raw_text_section(page2)
    assert "text page one" not in stripped1
    assert stripped1 == stripped2  # hash input เหมือนกันข้ามหน้า → hash เดียวกัน
    assert "RAW_TEXT_START" in stripped1
    assert "FOOTER" in stripped1
