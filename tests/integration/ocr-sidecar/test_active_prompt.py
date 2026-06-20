# File: tests/integration/ocr-sidecar/test_active_prompt.py
# Change Log:
# - 2026-06-20: Initial creation for US3 active prompt integration tests.

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
        return {"choices": [{"message": {"content": "{\"natural_text\": \"prompt result\"}"}}]}


class FakeAsyncClient:
    last_payload = None

    def __init__(self, *args, **kwargs) -> None:
        pass

    async def post(self, url: str, json: dict, headers: dict) -> FakeAsyncResponse:
        FakeAsyncClient.last_payload = json
        return FakeAsyncResponse()

    async def aclose(self) -> None:
        pass


def test_ocr_injects_system_prompt_and_dms_tags(tmp_path: Path) -> None:
    upload_base = tmp_path / "uploads"
    upload_base.mkdir()
    pdf_path = upload_base / "document.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n")

    app_module = load_app(upload_base)
    client = TestClient(app_module.app)

    decision = SimpleNamespace(keep_alive_seconds=120, reason="headroom-sufficient", vram_headroom_mb=9000.0)
    fake_client = FakeAsyncClient()
    FakeAsyncClient.last_payload = None

    # Prepare dummy message structure
    initial_messages = [{"role": "user", "content": [{"type": "text", "text": "OCR Page content"}]}]

    with patch.object(app_module, "calculate_ocr_residency", return_value=decision), \
         patch.object(app_module, "prepare_ocr_messages", return_value=initial_messages), \
         patch.object(app_module.fitz, "open", return_value=FakeDocument()), \
         patch.object(app_module, "ollama_client", fake_client):

        response = client.post(
            "/ocr",
            json={
                "pdfPath": str(pdf_path),
                "engine": "np-dms-ocr",
                "system_prompt": "Custom system instruction",
                "dms_tags": {
                    "document_number": "true",
                    "document_date": "true"
                },
                "runtime_params": {
                    "temperature": 0.1,
                    "top_p": 0.5,
                    "repeat_penalty": 1.0,
                    "max_tokens": 4096
                }
            },
            headers={"X-API-Key": "test-key"}
        )

    assert response.status_code == 200

    # Verify the message content in last payload sent to Ollama
    sent_messages = FakeAsyncClient.last_payload["messages"]

    # We expect system_prompt to be appended to messages[0]["content"]
    content_list = sent_messages[0]["content"]

    # Verify system prompt exists
    system_prompt_found = any(c.get("type") == "text" and c.get("text") == "Custom system instruction" for c in content_list)
    assert system_prompt_found, "System prompt was not injected into message content"

    # Verify DMS tags instruction exists
    dms_tags_instruction = any(c.get("type") == "text" and "<document_number>" in c.get("text") and "<document_date>" in c.get("text") for c in content_list)
    assert dms_tags_instruction, "DMS tags instructions were not injected correctly"
