# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/services/residency_policy.py
# Change Log:
# - 2026-06-11: Initial creation of residency_policy.py for calculating OCR keep_alive value dynamically

import os
import logging
from dataclasses import dataclass
from services.vram_monitor import get_vram_headroom

logger = logging.getLogger("ocr-sidecar.residency-policy")

@dataclass
class OcrResidencyDecision:
    keep_alive_seconds: int
    vram_headroom_mb: float
    reason: str

def calculate_ocr_residency(active_profile: str = None) -> OcrResidencyDecision:
    """
    คำนวณ keep_alive สำหรับ np-dms-ocr จาก VRAM headroom และ active profile ของโมเดลหลัก
    """
    threshold_mb = float(os.getenv("VRAM_HEADROOM_THRESHOLD_MB", "3000.0"))
    residency_window = int(os.getenv("OCR_RESIDENCY_WINDOW_SECONDS", "120"))
    pressure_threshold = float(os.getenv("GPU_MAIN_MODEL_PRESSURE_THRESHOLD_MB", "7000.0"))
    if active_profile in ("deep-analysis", "large-context"):
        return OcrResidencyDecision(0, -1.0, "large-context-active")
    headroom = get_vram_headroom()
    if not headroom.query_success:
        return OcrResidencyDecision(0, -1.0, "query-failed")
    if headroom.used_mb > pressure_threshold:
        return OcrResidencyDecision(0, headroom.available_mb, "high-pressure")
    if headroom.available_mb < threshold_mb:
        return OcrResidencyDecision(0, headroom.available_mb, "high-pressure")
    return OcrResidencyDecision(residency_window, headroom.available_mb, "headroom-sufficient")
