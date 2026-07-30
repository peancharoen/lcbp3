# File: specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/tests/test_prompt_cache.py
# Change Log:
# - 2026-07-23: Initial unit tests for prompt_cache module (Feature-142)

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from services.prompt_cache import (
    compute_prompt_hash,
    get_prompt_hash,
    set_prompt_hash,
    clear_prompt_hash,
    unload_ollama_model,
    check_and_unload_if_changed,
)


# ─── compute_prompt_hash tests (T016) ──────────────────────────────────────────


class TestComputePromptHash:
    """T016: ทดสอบ compute_prompt_hash — None, empty string, normal string, unicode (Thai)"""

    def test_none_returns_none_string(self):
        """systemPrompt=None ต้องคืนค่า 'none'"""
        assert compute_prompt_hash(None) == "none"

    def test_empty_string_returns_hash(self):
        """systemPrompt='' ต้องคืนค่า hash 16 chars (ไม่ใช่ 'none')"""
        result = compute_prompt_hash("")
        assert len(result) == 16
        assert result != "none"

    def test_normal_string_returns_16_hex_chars(self):
        """systemPrompt ปกติ ต้องคืนค่า 16 hex chars"""
        result = compute_prompt_hash("Extract all text from the document")
        assert len(result) == 16
        assert all(c in "0123456789abcdef" for c in result)

    def test_thai_unicode_returns_16_hex_chars(self):
        """systemPrompt ภาษาไทย ต้องคืนค่า 16 hex chars"""
        result = compute_prompt_hash("สกัดข้อความทั้งหมดจากเอกสาร")
        assert len(result) == 16
        assert all(c in "0123456789abcdef" for c in result)

    def test_different_prompts_different_hashes(self):
        """prompt ต่างกัน ต้องได้ hash ต่างกัน"""
        hash_a = compute_prompt_hash("Prompt A")
        hash_b = compute_prompt_hash("Prompt B")
        assert hash_a != hash_b

    def test_same_prompt_same_hash(self):
        """prompt เหมือนกัน ต้องได้ hash เหมือนกัน"""
        hash_a = compute_prompt_hash("Extract all text")
        hash_b = compute_prompt_hash("Extract all text")
        assert hash_a == hash_b

    def test_none_consistent(self):
        """None สองครั้ง ต้องได้ 'none' เหมือนกัน"""
        assert compute_prompt_hash(None) == compute_prompt_hash(None)


# ─── check_and_unload_if_changed tests (T017) ──────────────────────────────────


class TestCheckAndUnloadIfChanged:
    """T017: ทดสอบ check_and_unload_if_changed — hash match, mismatch, Redis miss, unload failure"""

    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client"""
        r = MagicMock()
        r.get = AsyncMock()
        r.set = AsyncMock()
        r.delete = AsyncMock()
        return r

    @pytest.mark.asyncio
    async def test_hash_match_skip_unload(self, mock_redis):
        """hash เหมือนเดิม → ไม่ unload (FR-003)"""
        prompt = "Extract all text"
        hash_val = compute_prompt_hash(prompt)
        mock_redis.get.return_value = hash_val

        result = await check_and_unload_if_changed(
            system_prompt=prompt,
            model_name="np-dms-ocr:latest",
            ollama_url="http://localhost:11434",
            redis_client=mock_redis,
        )

        assert result is False
        mock_redis.set.assert_not_called()

    @pytest.mark.asyncio
    async def test_hash_mismatch_triggers_unload(self, mock_redis):
        """hash ต่างกัน → unload + update hash (FR-002, FR-004)"""
        mock_redis.get.return_value = "aabbccdd11223344"

        with patch("services.prompt_cache.unload_ollama_model", new_callable=AsyncMock) as mock_unload:
            mock_unload.return_value = True
            result = await check_and_unload_if_changed(
                system_prompt="New prompt",
                model_name="np-dms-ocr:latest",
                ollama_url="http://localhost:11434",
                redis_client=mock_redis,
            )

            assert result is True
            mock_unload.assert_called_once()
            mock_redis.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_redis_miss_first_request_skip_unload(self, mock_redis):
        """Redis ไม่มี hash (first request) → ไม่ unload + อัปเดต hash (FR-003)"""
        mock_redis.get.return_value = None

        result = await check_and_unload_if_changed(
            system_prompt="First prompt",
            model_name="np-dms-ocr:latest",
            ollama_url="http://localhost:11434",
            redis_client=mock_redis,
        )

        assert result is False
        mock_redis.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_unload_failure_fallback(self, mock_redis):
        """Ollama unload fail → fallback (FR-006) + อัปเดต hash อยู่ดี"""
        mock_redis.get.return_value = "aabbccdd11223344"

        with patch("services.prompt_cache.unload_ollama_model", new_callable=AsyncMock) as mock_unload:
            mock_unload.return_value = False
            result = await check_and_unload_if_changed(
                system_prompt="New prompt after failure",
                model_name="np-dms-ocr:latest",
                ollama_url="http://localhost:11434",
                redis_client=mock_redis,
            )

            assert result is False
            mock_unload.assert_called_once()
            # hash ยังถูกอัปเดตเพื่อไม่ให้ unload ซ้ำใน request ถัดไป
            mock_redis.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_none_to_string_triggers_unload(self, mock_redis):
        """None → string: hash เปลี่ยน → unload (Edge Case)"""
        mock_redis.get.return_value = "none"

        with patch("services.prompt_cache.unload_ollama_model", new_callable=AsyncMock) as mock_unload:
            mock_unload.return_value = True
            result = await check_and_unload_if_changed(
                system_prompt="Now I have a prompt",
                model_name="np-dms-ocr:latest",
                ollama_url="http://localhost:11434",
                redis_client=mock_redis,
            )

            assert result is True
            mock_unload.assert_called_once()

    @pytest.mark.asyncio
    async def test_none_to_none_skip_unload(self, mock_redis):
        """None → None: hash เหมือนเดิม → ไม่ unload (Edge Case)"""
        mock_redis.get.return_value = "none"

        result = await check_and_unload_if_changed(
            system_prompt=None,
            model_name="np-dms-ocr:latest",
            ollama_url="http://localhost:11434",
            redis_client=mock_redis,
        )

        assert result is False


# ─── unload_ollama_model tests ─────────────────────────────────────────────────


class TestUnloadOllamaModel:
    """ทดสอบ unload_ollama_model — success + failure"""

    @pytest.mark.asyncio
    async def test_unload_success(self):
        """unload สำเร็จ → คืน True"""
        mock_client = MagicMock()
        mock_client.post = AsyncMock()
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_client.post.return_value = mock_response

        result = await unload_ollama_model(
            ollama_url="http://localhost:11434",
            model_name="np-dms-ocr:latest",
            ollama_client=mock_client,
        )

        assert result is True
        mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_unload_failure_returns_false(self):
        """unload fail → คืน False (ไม่ throw) — FR-006"""
        mock_client = MagicMock()
        mock_client.post = AsyncMock(side_effect=Exception("Connection refused"))

        result = await unload_ollama_model(
            ollama_url="http://localhost:11434",
            model_name="np-dms-ocr:latest",
            ollama_client=mock_client,
        )

        assert result is False


# ─── clear_prompt_hash tests (T018) ────────────────────────────────────────────


class TestClearPromptHash:
    """T018: ทดสอบ clear_prompt_hash — ล้าง hash เมื่อ Ollama crash"""

    @pytest.mark.asyncio
    async def test_clear_hash(self):
        """clear_prompt_hash ต้องเรียก Redis DELETE"""
        mock_redis = MagicMock()
        mock_redis.delete = AsyncMock()

        await clear_prompt_hash(mock_redis, "np-dms-ocr:latest")

        mock_redis.delete.assert_called_once_with("ocr:prompt:hash:np-dms-ocr:latest")
