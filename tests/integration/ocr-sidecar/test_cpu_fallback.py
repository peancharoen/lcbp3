# File: tests/integration/ocr-sidecar/test_cpu_fallback.py
# Change Log:
# - 2026-06-20: Added ADR-040 CPU fallback integration coverage for retrieval endpoints.

from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import sys

UNIT_DIR = Path(__file__).resolve().parents[2] / "unit" / "ocr-sidecar"
if str(UNIT_DIR) not in sys.path:
    sys.path.insert(0, str(UNIT_DIR))

from test_path_traversal import load_app


def test_embed_uses_cpu_when_vram_headroom_is_low(tmp_path: Path) -> None:
    app_module = load_app(tmp_path)
    client = TestClient(app_module.app)
    bge_model = MagicMock()
    bge_model.encode.return_value = {
        "dense_vecs": [[0.1, 0.2]],
        "lexical_weights": [{"101": 0.5}],
    }
    headroom = MagicMock(total_mb=16384.0, used_mb=15000.0, available_mb=1000.0, query_success=True)
    with patch.object(app_module, "bge_model", bge_model), patch.object(app_module, "get_vram_headroom", return_value=headroom):
        response = client.post("/embed", json={"text": "hello"}, headers={"X-API-Key": "test-key"})
    assert response.status_code == 200
    assert response.json()["device"] == "cpu"
    bge_model.model.to.assert_called_with("cpu")


def test_rerank_uses_cpu_when_vram_headroom_is_low(tmp_path: Path) -> None:
    app_module = load_app(tmp_path)
    client = TestClient(app_module.app)
    reranker = MagicMock()
    reranker.compute_score.return_value = [0.9]
    headroom = MagicMock(total_mb=16384.0, used_mb=15000.0, available_mb=1000.0, query_success=True)
    with patch.object(app_module, "reranker", reranker), patch.object(app_module, "get_vram_headroom", return_value=headroom):
        response = client.post(
            "/rerank",
            json={"query": "q", "chunks": ["chunk"]},
            headers={"X-API-Key": "test-key"},
        )
    assert response.status_code == 200
    assert response.json()["device"] == "cpu"
    reranker.model.to.assert_called_with("cpu")
