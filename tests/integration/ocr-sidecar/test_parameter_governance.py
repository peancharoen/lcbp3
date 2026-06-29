# File: tests/integration/ocr-sidecar/test_parameter_governance.py
# Change Log:
# - 2026-06-20: Initial creation for US3 parameter governance integration tests.

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

UNIT_DIR = Path(__file__).resolve().parents[2] / "unit" / "ocr-sidecar"
if str(UNIT_DIR) not in sys.path:
    sys.path.insert(0, str(UNIT_DIR))

from test_path_traversal import FakeDocument, load_app


class FakeAsyncResponse:
    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return {"choices": [{"message": {"content": "{\"natural_text\": \"governed result\"}"}}]}


class FakeAsyncClient:
    last_payload = None

    def __init__(self, *args, **kwargs) -> None:
        pass

    async def post(self, url: str, json: dict, headers: dict) -> FakeAsyncResponse:
        FakeAsyncClient.last_payload = json
        return FakeAsyncResponse()

    async def aclose(self) -> None:
        pass


def test_ocr_uses_governed_runtime_parameters(tmp_path: Path) -> None:
    upload_base = tmp_path / "uploads"
    upload_base.mkdir()
    pdf_path = upload_base / "document.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n")

    app_module = load_app(upload_base)
    client = TestClient(app_module.app)

    decision = SimpleNamespace(keep_alive_seconds=120, reason="headroom-sufficient", vram_headroom_mb=9000.0)
    fake_client = FakeAsyncClient()
    FakeAsyncClient.last_payload = None

    with patch.object(app_module, "calculate_ocr_residency", return_value=decision), \
         patch.object(app_module, "prepare_ocr_messages", return_value=[{"content": []}]), \
         patch.object(app_module.fitz, "open", return_value=FakeDocument()), \
         patch.object(app_module, "ollama_client", fake_client):

        response = client.post(
            "/ocr",
            json={
                "pdfPath": str(pdf_path),
                "engine": "np-dms-ocr",
                "runtime_params": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "repeat_penalty": 1.1,
                    "max_tokens": 4096
                }
            },
            headers={"X-API-Key": "test-key"}
        )

    assert response.status_code == 200
    assert response.json()["text"] == "governed result"

    # Check that parameters were passed to Ollama payload
    assert FakeAsyncClient.last_payload["temperature"] == 0.7
    assert FakeAsyncClient.last_payload["top_p"] == 0.9
    assert FakeAsyncClient.last_payload["repetition_penalty"] == 1.1
    assert FakeAsyncClient.last_payload["max_tokens"] == 4096
