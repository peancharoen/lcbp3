# File: specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/tests/test_network_isolation.py
# Change Log:
# - 2026-07-31: T047 — Network isolation test (ADR-040 Phase 7 / US5)
#   ตรวจสอบว่า sidecar endpoints ทำงานได้โดยไม่ต้อง X-API-Key auth
#   และยืนยันว่าไม่มี auth middleware หลงเหลือหลัง ADR-040 Phase 2

"""
Integration test สำหรับ Network Isolation Auth (ADR-040 Phase 7 / US5 / T047)

หลัง ADR-041 server consolidation + ADR-040 Phase 2:
- sidecar endpoints (/ocr, /ocr-upload, /embed, /rerank) ไม่ต้องมี X-API-Key header
- พึ่ง Docker-internal network isolation เท่านั้น (bridge network ไม่ expose port ออกภายนอก)
- test นี้ยืนยันว่า:
  1. ไม่มี X-API-Key validation หลงเหลือใน app.py
  2. endpoints ตอบสนองได้โดยไม่ต้องส่ง X-API-Key header
  3. ไม่มี OCR_SIDECAR_API_KEY env var dependency
"""

import pytest
from fastapi.testclient import TestClient
import os
import inspect

# Setup env variables before importing app (ไม่รวม OCR_SIDECAR_API_KEY เพื่อยืนยันว่าไม่จำเป็น)
os.environ["VRAM_HEADROOM_THRESHOLD_MB"] = "3000.0"
os.environ["RETRIEVAL_TIMEOUT_SECONDS"] = "2.0"

from app import app

client = TestClient(app)


class TestNetworkIsolationAuth:
    """ADR-040 Phase 7 / US5 / T047 — ยืนยันว่า X-API-Key auth ถูกลบหมดแล้ว"""

    def test_no_api_key_dependency_in_app(self):
        """ตรวจสอบว่าไม่มี get_api_key function หรือ api_key_header dependency หลงเหลือใน app module"""
        import app as app_module

        # ไม่ควรมี get_api_key หรือ api_key_header ใน module symbols
        assert not hasattr(app_module, "get_api_key"), (
            "get_api_key function ยังคงอยู่ — ละเมิด ADR-040 Phase 2 (T016)"
        )
        assert not hasattr(app_module, "api_key_header"), (
            "api_key_header dependency ยังคงอยู่ — ละเมิด ADR-040 Phase 2 (T016)"
        )

    def test_no_ocr_sidecar_api_key_env_required(self):
        """ตรวจสอบว่าไม่มี OCR_SIDECAR_API_KEY env var ที่จำเป็นต้องตั้งค่า"""
        # ลบ env var ออก (ถ้ามี) เพื่อจำลองสภาพแวดล้อมที่ไม่มี API key
        os.environ.pop("OCR_SIDECAR_API_KEY", None)
        # app ควร import ได้โดยไม่ throw error เกี่ยวกับ missing API key
        # (ถ้า import สำเร็จถึงตรงนี้ = ผ่าน)
        import app as app_module

        assert app_module.app is not None

    def test_health_endpoint_no_auth_required(self):
        """GET /health ต้องตอบสนองได้โดยไม่ต้อง X-API-Key header"""
        response = client.get("/health")
        # ตอบ 200 หรือ 503 (ถ้า GPU ไม่พร้อม) แต่ต้องไม่ 401/403 (auth fail)
        assert response.status_code != 401, (
            "/health ยังคงต้องการ auth — ละเมิด ADR-040 Phase 2"
        )
        assert response.status_code != 403, (
            "/health ยังคงต้องการ auth — ละเมิด ADR-040 Phase 2"
        )

    def test_ocr_upload_endpoint_no_auth_header_required(self):
        """POST /ocr-upload ต้องไม่ปฏิเสธ request ที่ไม่มี X-API-Key header (auth ไม่ใช่สาเหตุ)"""
        # ส่ง request โดยไม่มี X-API-Key header — อาจได้ 422 (validation) แต่ต้องไม่ 401/403
        response = client.post(
            "/ocr-upload",
            files={"file": ("test.pdf", b"fake-pdf-bytes", "application/pdf")},
            data={"engine": "np-dms-ocr"},
        )
        assert response.status_code != 401, (
            "/ocr-upload ยังคงต้องการ X-API-Key — ละเมิด ADR-040 Phase 2 (T016)"
        )
        assert response.status_code != 403, (
            "/ocr-upload ยังคงต้องการ X-API-Key — ละเมิด ADR-040 Phase 2 (T016)"
        )

    def test_embed_endpoint_no_auth_header_required(self):
        """POST /embed ต้องไม่ปฏิเสธ request ที่ไม่มี X-API-Key header (auth ไม่ใช่สาเหตุ)"""
        response = client.post(
            "/embed",
            json={"texts": ["test text"]},
        )
        assert response.status_code != 401, (
            "/embed ยังคงต้องการ X-API-Key — ละเมิด ADR-040 Phase 2 (T016)"
        )
        assert response.status_code != 403, (
            "/embed ยังคงต้องการ X-API-Key — ละเมิด ADR-040 Phase 2 (T016)"
        )

    def test_rerank_endpoint_no_auth_header_required(self):
        """POST /rerank ต้องไม่ปฏิเสธ request ที่ไม่มี X-API-Key header (auth ไม่ใช่สาเหตุ)"""
        response = client.post(
            "/rerank",
            json={"query": "test", "documents": ["doc1"]},
        )
        assert response.status_code != 401, (
            "/rerank ยังคงต้องการ X-API-Key — ละเมิด ADR-040 Phase 2 (T016)"
        )
        assert response.status_code != 403, (
            "/rerank ยังคงต้องการ X-API-Key — ละเมิด ADR-040 Phase 2 (T016)"
        )

    def test_no_x_api_key_in_source_code(self):
        """ตรวจ source code ของ app.py ว่าไม่มี X-API-Key validation logic หลงเหลือ"""
        import app as app_module

        source = inspect.getsource(app_module)
        # ตรวจว่าไม่มีการอ้างถึง X-API-Key ใน source (ยกเว้น comments/history)
        # นับบรรทัดที่อ้าง X-API-Key นอก comments
        lines_with_x_api_key = []
        for line in source.split("\n"):
            stripped = line.strip()
            # ข้าม comments และ change log
            if stripped.startswith("#") or stripped.startswith('"""'):
                continue
            if "X-API-Key" in line or "x-api-key" in line.lower():
                lines_with_x_api_key.append(line)

        assert len(lines_with_x_api_key) == 0, (
            f"พบ X-API-Key reference ใน source code (non-comment): {lines_with_x_api_key} — "
            "ละเมิด ADR-040 Phase 2 (T016)"
        )
