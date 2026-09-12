# File: specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/tests/test_leakage_retry.py
# Change Log:
# - 2026-09-12: Initial tests สำหรับ A2 — retry/unload-on-leakage

"""
ทดสอบ retry/unload-on-leakage logic ใน _process_ocr_impl (A2)

สถานการณ์ที่ทดสอบ:
1. Leakage detected → unload success → retry สำเร็จ (ไม่ leakage ซ้ำ) → คืน text
2. Leakage detected → unload success → retry ยัง leakage → คืน empty text
3. Leakage detected → unload fail → คืน empty text (ไม่ retry)
4. ไม่มี leakage → ไม่ unload ไม่ retry → คืน text ปกติ
"""

import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from types import ModuleType

# Mock typhoon_ocr ก่อน import app (module ภายนอกจาก PyPI — ไม่จำเป็นต้องติดตั้งจริงใน test env)
_typhoon_mock = ModuleType("typhoon_ocr")
_typhoon_mock.prepare_ocr_messages = lambda *args, **kwargs: [
    {"content": [{"type": "text", "text": "test prompt"}]}
]
sys.modules["typhoon_ocr"] = _typhoon_mock

# Mock FlagEmbedding ด้วย (module หนัก ไม่จำเป็นสำหรับ unit test)
_flag_mock = ModuleType("FlagEmbedding")
_flag_mock.BGEM3FlagModel = MagicMock()
_flag_mock.FlagReranker = MagicMock()
sys.modules["FlagEmbedding"] = _flag_mock


class TestLeakageRetry:
    """A2: ทดสอบ retry/unload-on-leakage ใน _process_ocr_impl"""

    @pytest.fixture
    def mock_ollama_client(self):
        """Mock shared httpx.AsyncClient สำหรับ Ollama API"""
        client = MagicMock()
        client.post = AsyncMock()
        return client

    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client"""
        r = MagicMock()
        r.get = AsyncMock(return_value=None)
        r.set = AsyncMock()
        r.delete = AsyncMock()
        return r

    @pytest.mark.asyncio
    async def test_no_leakage_returns_text(self, mock_ollama_client, mock_redis):
        """ไม่มี leakage → คืน text ปกติ ไม่ unload ไม่ retry"""
        # จำลอง Ollama คืน text ปกติ (ไม่มี leakage markers)
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": '{"natural_text": "เอกสารปกติ ไม่มี leakage"}'}
        }
        mock_ollama_client.post.return_value = mock_response

        with patch("app.ollama_client", mock_ollama_client), \
             patch("app.redis_client", mock_redis), \
             patch("app.OLLAMA_API_URL", "http://localhost:11434"), \
             patch("app.OCR_MODEL", "np-dms-ocr:latest"), \
             patch("app.OCR_ACTIVE_PROFILE", None), \
             patch("app.calculate_ocr_residency") as mock_residency, \
             patch("app.check_and_unload_if_changed", new_callable=AsyncMock), \
             patch("app.prepare_ocr_messages") as mock_prepare, \
             patch("app.clear_prompt_hash", new_callable=AsyncMock) as mock_clear, \
             patch("app.unload_ollama_model", new_callable=AsyncMock) as mock_unload:
            mock_residency.return_value = MagicMock(keep_alive_seconds=120, reason="test", vram_headroom_mb=8000)
            mock_prepare.return_value = [{"content": [{"type": "text", "text": "test prompt"}]}]

            from app import _process_ocr_impl
            result = await _process_ocr_impl(
                pdf_path="/tmp/test.pdf",
                page_num=1,
            )

            assert result == "เอกสารปกติ ไม่มี leakage"
            mock_unload.assert_not_called()
            mock_clear.assert_not_called()

    @pytest.mark.asyncio
    async def test_leakage_unload_success_retry_success(self, mock_ollama_client, mock_redis):
        """Leakage → unload success → retry สำเร็จ (ไม่ leakage) → คืน text จาก retry"""
        # ครั้งที่ 1: leakage (echo training prompt)
        # ครั้งที่ 2: สำเร็จ (text ปกติ)
        leakage_response = MagicMock()
        leakage_response.raise_for_status = MagicMock()
        leakage_response.json.return_value = {
            "message": {"content": "Extract all text from the image and return Markdown"}
        }
        success_response = MagicMock()
        success_response.raise_for_status = MagicMock()
        success_response.json.return_value = {
            "message": {"content": '{"natural_text": "OCR สำเร็จหลัง retry"}'}
        }
        mock_ollama_client.post.side_effect = [leakage_response, success_response]

        with patch("app.ollama_client", mock_ollama_client), \
             patch("app.redis_client", mock_redis), \
             patch("app.OLLAMA_API_URL", "http://localhost:11434"), \
             patch("app.OCR_MODEL", "np-dms-ocr:latest"), \
             patch("app.OCR_ACTIVE_PROFILE", None), \
             patch("app.calculate_ocr_residency") as mock_residency, \
             patch("app.check_and_unload_if_changed", new_callable=AsyncMock), \
             patch("app.prepare_ocr_messages") as mock_prepare, \
             patch("app.clear_prompt_hash", new_callable=AsyncMock) as mock_clear, \
             patch("app.unload_ollama_model", new_callable=AsyncMock) as mock_unload:
            mock_residency.return_value = MagicMock(keep_alive_seconds=120, reason="test", vram_headroom_mb=8000)
            mock_unload.return_value = True
            mock_prepare.return_value = [{"content": [{"type": "text", "text": "test prompt"}]}]

            from app import _process_ocr_impl
            result = await _process_ocr_impl(
                pdf_path="/tmp/test.pdf",
                page_num=1,
            )

            assert result == "OCR สำเร็จหลัง retry"
            mock_unload.assert_called_once()
            mock_clear.assert_called_once()

    @pytest.mark.asyncio
    async def test_leakage_unload_success_retry_still_leakage(self, mock_ollama_client, mock_redis):
        """Leakage → unload success → retry ยัง leakage → คืน empty text"""
        # ทั้งสองครั้งเป็น leakage
        leakage_response = MagicMock()
        leakage_response.raise_for_status = MagicMock()
        leakage_response.json.return_value = {
            "message": {"content": "Only return the clean Markdown from the image"}
        }
        mock_ollama_client.post.side_effect = [leakage_response, leakage_response]

        with patch("app.ollama_client", mock_ollama_client), \
             patch("app.redis_client", mock_redis), \
             patch("app.OLLAMA_API_URL", "http://localhost:11434"), \
             patch("app.OCR_MODEL", "np-dms-ocr:latest"), \
             patch("app.OCR_ACTIVE_PROFILE", None), \
             patch("app.calculate_ocr_residency") as mock_residency, \
             patch("app.check_and_unload_if_changed", new_callable=AsyncMock), \
             patch("app.prepare_ocr_messages") as mock_prepare, \
             patch("app.clear_prompt_hash", new_callable=AsyncMock) as mock_clear, \
             patch("app.unload_ollama_model", new_callable=AsyncMock) as mock_unload:
            mock_residency.return_value = MagicMock(keep_alive_seconds=120, reason="test", vram_headroom_mb=8000)
            mock_unload.return_value = True
            mock_prepare.return_value = [{"content": [{"type": "text", "text": "test prompt"}]}]

            from app import _process_ocr_impl
            result = await _process_ocr_impl(
                pdf_path="/tmp/test.pdf",
                page_num=1,
            )

            assert result == ""
            mock_unload.assert_called_once()
            mock_clear.assert_called_once()

    @pytest.mark.asyncio
    async def test_leakage_unload_fail_returns_empty(self, mock_ollama_client, mock_redis):
        """Leakage → unload fail → คืน empty text (ไม่ retry)"""
        leakage_response = MagicMock()
        leakage_response.raise_for_status = MagicMock()
        leakage_response.json.return_value = {
            "message": {"content": "Do not include any explanation or extra text"}
        }
        mock_ollama_client.post.return_value = leakage_response

        with patch("app.ollama_client", mock_ollama_client), \
             patch("app.redis_client", mock_redis), \
             patch("app.OLLAMA_API_URL", "http://localhost:11434"), \
             patch("app.OCR_MODEL", "np-dms-ocr:latest"), \
             patch("app.OCR_ACTIVE_PROFILE", None), \
             patch("app.calculate_ocr_residency") as mock_residency, \
             patch("app.check_and_unload_if_changed", new_callable=AsyncMock), \
             patch("app.prepare_ocr_messages") as mock_prepare, \
             patch("app.clear_prompt_hash", new_callable=AsyncMock) as mock_clear, \
             patch("app.unload_ollama_model", new_callable=AsyncMock) as mock_unload:
            mock_residency.return_value = MagicMock(keep_alive_seconds=120, reason="test", vram_headroom_mb=8000)
            mock_unload.return_value = False
            mock_prepare.return_value = [{"content": [{"type": "text", "text": "test prompt"}]}]

            from app import _process_ocr_impl
            result = await _process_ocr_impl(
                pdf_path="/tmp/test.pdf",
                page_num=1,
            )

            assert result == ""
            mock_unload.assert_called_once()
            # ไม่ควร clear hash เพราะ unload fail
            mock_clear.assert_not_called()
