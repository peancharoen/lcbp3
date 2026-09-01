# File: specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/services/prompt_cache.py
# Prompt Cache Invalidation — Redis-based prompt hash tracking + Ollama model unload (Feature-142)
# Change Log:
# - 2026-07-23: Initial creation — prompt hash storage, unload logic, check_and_unload_if_changed

"""
โมดูลสำหรับจัดการ prompt cache invalidation ใน Ollama

เมื่อ Ollama model ค้างใน VRAM (keep_alive > 0) การเปลี่ยน system prompt ใน payload
ไม่มีผล เพราะ KV cache ยึด context เดิม โมดูลนี้ตรวจจับการเปลี่ยน prompt และ
บังคับ unload model ก่อนประมวลผล request ใหม่
"""

import hashlib
import logging
import os
from typing import Optional

import httpx
import redis.asyncio as aioredis

logger = logging.getLogger("ocr-sidecar.prompt_cache")

# Redis key schema: ocr:prompt:hash:<model_name>
_REDIS_KEY_PREFIX = "ocr:prompt:hash:"

# ค่า hash สำหรับ systemPrompt=None
_NONE_HASH = "none"


def compute_prompt_hash(system_prompt: Optional[str]) -> str:
    """
    คำนวณ hash ของ system prompt โดยใช้ SHA-256 ตัดเหลือ 16 hex chars

    รองรับ systemPrompt=None (คืนค่า "none") และ empty string (คืนค่า hash ของ "")
    ตาม FR-007: prompt hash comparison ต้องครอบคลุมทั้งกรณี None และ string

    Args:
        system_prompt: system prompt text หรือ None

    Returns:
        16 hex chars string หรือ "none" สำหรับ None
    """
    if system_prompt is None:
        return _NONE_HASH
    return hashlib.sha256(system_prompt.encode("utf-8")).hexdigest()[:16]


async def get_prompt_hash(redis_client: aioredis.Redis, model_name: str) -> Optional[str]:
    """
    อ่าน prompt hash ล่าสุดจาก Redis (FR-001)

    Args:
        redis_client: async Redis client
        model_name: ชื่อ Ollama model (ใช้เป็น key suffix)

    Returns:
        hash string หรือ None หากไม่มีใน Redis (first request หลัง restart)
    """
    key = f"{_REDIS_KEY_PREFIX}{model_name}"
    stored = await redis_client.get(key)
    if stored is not None:
        return stored.decode("utf-8") if isinstance(stored, bytes) else str(stored)
    return None


async def set_prompt_hash(redis_client: aioredis.Redis, model_name: str, hash_value: str) -> None:
    """
    บันทึก prompt hash ลง Redis (FR-004: หลัง unload เสร็จ ต้องอัปเดต hash)

    Args:
        redis_client: async Redis client
        model_name: ชื่อ Ollama model
        hash_value: hash 16 hex chars หรือ "none"
    """
    key = f"{_REDIS_KEY_PREFIX}{model_name}"
    await redis_client.set(key, hash_value)
    logger.debug(f"Prompt hash stored in Redis: key={key} value={hash_value}")


async def clear_prompt_hash(redis_client: aioredis.Redis, model_name: str) -> None:
    """
    ล้าง prompt hash ออกจาก Redis — ใช้เมื่อ Ollama crash/restart (Edge Case)

    การล้าง hash ทำให้ request ถัดไปถือว่าเป็น first request → ไม่ unload

    Args:
        redis_client: async Redis client
        model_name: ชื่อ Ollama model
    """
    key = f"{_REDIS_KEY_PREFIX}{model_name}"
    await redis_client.delete(key)
    logger.warning(f"Prompt hash cleared from Redis (Ollama crash/restart): key={key}")


async def unload_ollama_model(
    ollama_url: str,
    model_name: str,
    ollama_client: Optional[httpx.AsyncClient] = None,
) -> bool:
    """
    บังคับ unload model จาก Ollama VRAM โดยส่ง empty request พร้อม keep_alive=0 (FR-002)

    ใช้ native endpoint /api/generate เพราะรองรับ empty prompt สำหรับ unload โดยตรง

    Args:
        ollama_url: Ollama API base URL (เช่น http://host.docker.internal:11434)
        model_name: ชื่อ Ollama model (เช่น np-dms-ocr:latest)
        ollama_client: shared httpx.AsyncClient (ถ้าไม่ส่ง จะสร้างชั่วคราว)

    Returns:
        True หาก unload สำเร็จ, False หาก fail (FR-006: fallback + log warning)
    """
    payload = {
        "model": model_name,
        "prompt": "",
        "keep_alive": 0,
        "stream": False,
    }
    client = ollama_client
    temp_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=30)
        temp_client = True

    try:
        response = await client.post(
            f"{ollama_url}/api/generate",
            json=payload,
        )
        response.raise_for_status()
        logger.info(f"Model unload successful: model={model_name}")
        return True
    except Exception as e:
        # FR-006: fallback — log warning และ return False (ไม่ throw)
        logger.warning(
            f"Model unload failed (best-effort fallback): model={model_name} "
            f"error={e}"
        )
        return False
    finally:
        if temp_client:
            await client.aclose()


async def check_and_unload_if_changed(
    system_prompt: Optional[str],
    model_name: str,
    ollama_url: str,
    redis_client: aioredis.Redis,
    ollama_client: Optional[httpx.AsyncClient] = None,
) -> bool:
    """
    เปรียบเทียบ prompt hash และ unload model หาก prompt เปลี่ยน (FR-001 ถึง FR-005)

    Flow:
    1. คำนวณ hash ของ system_prompt ปัจจุบัน
    2. อ่าน hash เดิมจาก Redis
    3. หาก hash เหมือนกัน → skip unload (FR-003)
    4. หาก hash ต่างกัน → unload model (FR-002) → อัปเดต Redis hash (FR-004)
    5. หากไม่มี hash ใน Redis (first request) → skip unload (FR-003)

    Args:
        system_prompt: system prompt text หรือ None
        model_name: ชื่อ Ollama model
        ollama_url: Ollama API base URL
        redis_client: async Redis client
        ollama_client: shared httpx.AsyncClient

    Returns:
        True หากมีการ unload, False หาก skip unload
    """
    current_hash = compute_prompt_hash(system_prompt)
    stored_hash = await get_prompt_hash(redis_client, model_name)

    if stored_hash is None:
        # FR-003: first request — ไม่ unload, แต่อัปเดต hash
        logger.info(
            f"no cached prompt hash — first request, skipping unload "
            f"(model={model_name}, hash={current_hash})"
        )
        await set_prompt_hash(redis_client, model_name, current_hash)
        return False

    if stored_hash == current_hash:
        # FR-003: hash เหมือนเดิม — skip unload
        logger.info(
            f"prompt unchanged (hash_{current_hash}) — skipping unload "
            f"(model={model_name})"
        )
        return False

    # FR-002: hash ต่างกัน — unload model
    # FR-005: log เหตุผลการ unload ตามรูปแบบ SC-004
    logger.info(
        f"systemPrompt changed (hash_{stored_hash} → hash_{current_hash}) — "
        f"forcing model unload (model={model_name})"
    )
    unload_success = await unload_ollama_model(ollama_url, model_name, ollama_client)

    # FR-004: อัปเดต prompt hash เป็นค่าใหม่ก่อนประมวลผล (แม้ unload fail ก็อัปเดต
    # เพื่อไม่ให้ unload ซ้ำใน request ถัดไป — best-effort)
    await set_prompt_hash(redis_client, model_name, current_hash)

    if not unload_success:
        logger.warning(
            f"unload failed but hash updated — next request will use new prompt "
            f"(model={model_name})"
        )

    return unload_success


def init_redis_client() -> aioredis.Redis:
    """
    สร้าง async Redis client จาก REDIS_URL environment variable

    Returns:
        aioredis.Redis instance (ใช้สำหรับ get/set prompt hash)
    """
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    # ใช้ protocol=2 เพื่อหลีกเลี่ยง RESP3 HELLO handshake issue กับ Redis ที่ require auth
    return aioredis.from_url(redis_url, decode_responses=True, protocol=2)
