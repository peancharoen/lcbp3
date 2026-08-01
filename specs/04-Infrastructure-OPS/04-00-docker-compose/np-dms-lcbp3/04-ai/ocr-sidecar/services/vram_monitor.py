# File: specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/services/vram_monitor.py
# Change Log:
# - 2026-06-11: Initial creation of VramMonitor service for Python OCR sidecar to query GPU VRAM headroom from Ollama /api/ps
# - 2026-07-31: PERF-1 fix — เพิ่ม async get_vram_headroom_async() สำหรับการเรียกจาก async endpoints (ไม่บล็อก event loop)

from dataclasses import dataclass
import os
import asyncio
import httpx
import logging

logger = logging.getLogger("ocr-sidecar.vram-monitor")

@dataclass
class VramHeadroom:
    total_mb: float
    used_mb: float
    available_mb: float
    query_success: bool

def get_vram_headroom() -> VramHeadroom:
    """
    ดึงข้อมูล VRAM headroom จาก Ollama /api/ps (synchronous — สำหรับ non-async context)
    และคำนวณพื้นที่คงเหลือใน VRAM เพื่อประกอบการตัดสินใจเรื่อง Residency และ CPU Fallback
    """
    ollama_url = os.getenv("OLLAMA_API_URL", "http://host.docker.internal:11434")
    total_vram_mb = float(os.getenv("GPU_TOTAL_VRAM_MB", "16384.0"))
    try:
        # ดึงสถานะ running models จาก Ollama
        with httpx.Client(timeout=3.0) as client:
            response = client.get(f"{ollama_url}/api/ps")
        if response.status_code != 200:
            logger.warning(f"Ollama ps endpoint returned status code: {response.status_code}")
            return VramHeadroom(total_vram_mb, total_vram_mb, 0.0, False)
        data = response.json()
        models = data.get("models", [])
        total_used_bytes = 0
        for model in models:
            total_used_bytes += model.get("size_vram", 0)
        used_mb = float(total_used_bytes) / (1024.0 * 1024.0)
        available_mb = max(0.0, total_vram_mb - used_mb)
        return VramHeadroom(total_vram_mb, used_mb, available_mb, True)
    except Exception as e:
        logger.warning(f"Failed to query Ollama VRAM: {str(e)}")
        # เปลี่ยนจาก pessimistic (assume all VRAM used) เป็น optimistic (assume no VRAM used)
        # เพื่อป้องกัน false positive OOM Guard เมื่อ query ล้มเหลวแต่ไม่มี model load จริง
        return VramHeadroom(total_vram_mb, 0.0, total_vram_mb, False)

async def get_vram_headroom_async() -> VramHeadroom:
    """
    Async version ของ get_vram_headroom — ใช้ asyncio.to_thread เพื่อไม่บล็อก event loop
    ใช้สำหรับการเรียกจาก async endpoints (e.g., /ocr-upload, /embed, /rerank)
    """
    return await asyncio.to_thread(get_vram_headroom)
