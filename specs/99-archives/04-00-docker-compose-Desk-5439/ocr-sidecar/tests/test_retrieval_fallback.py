# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/tests/test_retrieval_fallback.py
# Change Log:
# - 2026-06-11: Initial integration tests for retrieval fallback using pytest

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import os
import asyncio

# Setup env variables before importing app
os.environ["OCR_SIDECAR_API_KEY"] = "test-key"
os.environ["VRAM_HEADROOM_THRESHOLD_MB"] = "3000.0"
os.environ["RETRIEVAL_TIMEOUT_SECONDS"] = "2.0"

from app import app, EmbedRequest, RerankRequest, get_api_key

client = TestClient(app)
API_HEADERS = {"X-API-Key": "test-key"}

@pytest.fixture
def mock_bge_model():
    with patch("app.bge_model") as mock:
        mock.model = MagicMock()
        mock.encode.return_value = {
            "dense_vecs": [[0.1, 0.2]],
            "lexical_weights": [{"101": 0.5}]
        }
        yield mock

@pytest.fixture
def mock_reranker():
    with patch("app.reranker") as mock:
        mock.model = MagicMock()
        mock.compute_score.return_value = [0.85]
        yield mock

def test_embed_gpu_when_headroom_sufficient(mock_bge_model):
    vram_mock = MagicMock(total_mb=16384.0, used_mb=2000.0, available_mb=14384.0, query_success=True)
    with patch("app.get_vram_headroom", return_value=vram_mock), \
         patch("torch.cuda.is_available", return_value=True):
        response = client.post("/embed", json={"text": "hello test"}, headers=API_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["device"] == "cuda"
        mock_bge_model.model.to.assert_called_with("cuda")

def test_embed_cpu_when_headroom_insufficient(mock_bge_model):
    vram_mock = MagicMock(total_mb=16384.0, used_mb=14000.0, available_mb=2384.0, query_success=True)
    with patch("app.get_vram_headroom", return_value=vram_mock):
        response = client.post("/embed", json={"text": "hello test"}, headers=API_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["device"] == "cpu"
        mock_bge_model.model.to.assert_called_with("cpu")

def test_embed_cpu_when_gpu_query_failed(mock_bge_model):
    vram_mock = MagicMock(total_mb=16384.0, used_mb=16384.0, available_mb=0.0, query_success=False)
    with patch("app.get_vram_headroom", return_value=vram_mock):
        response = client.post("/embed", json={"text": "hello test"}, headers=API_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["device"] == "cpu"
        mock_bge_model.model.to.assert_called_with("cpu")

def test_embed_timeout_returns_504(mock_bge_model):
    vram_mock = MagicMock(total_mb=16384.0, used_mb=2000.0, available_mb=14384.0, query_success=True)
    # Mock encode to simulate a slow run
    def slow_encode(*args, **kwargs):
        import time
        time.sleep(3.0)
        return {"dense_vecs": [[0.1]], "lexical_weights": [{"1": 0.1}]}
    mock_bge_model.encode.side_effect = slow_encode
    with patch("app.get_vram_headroom", return_value=vram_mock):
        response = client.post("/embed", json={"text": "hello test"}, headers=API_HEADERS)
        assert response.status_code == 504

def test_rerank_gpu_when_headroom_sufficient(mock_reranker):
    vram_mock = MagicMock(total_mb=16384.0, used_mb=2000.0, available_mb=14384.0, query_success=True)
    with patch("app.get_vram_headroom", return_value=vram_mock), \
         patch("torch.cuda.is_available", return_value=True):
        response = client.post("/rerank", json={"query": "test query", "chunks": ["chunk1"]}, headers=API_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["device"] == "cuda"
        mock_reranker.model.to.assert_called_with("cuda")

def test_rerank_cpu_when_headroom_insufficient(mock_reranker):
    vram_mock = MagicMock(total_mb=16384.0, used_mb=14000.0, available_mb=2384.0, query_success=True)
    with patch("app.get_vram_headroom", return_value=vram_mock):
        response = client.post("/rerank", json={"query": "test query", "chunks": ["chunk1"]}, headers=API_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["device"] == "cpu"
        mock_reranker.model.to.assert_called_with("cpu")
