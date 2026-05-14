# Quickstart: Unified AI Architecture

## 1. Setup the AI Host (Desk-5439)
1. Install Ollama and pull `gemma4:9b` and `nomic-embed-text`.
2. Start the Qdrant container with persistent storage.
3. Start n8n and configure the API key to connect to the DMS backend.

## 2. Environment Variables (Backend)
Add the following to your `.env`:
```bash
AI_HOST_URL=http://<desk-5439-ip>
AI_QDRANT_URL=http://<desk-5439-ip>:6333
AI_N8N_WEBHOOK_URL=http://<desk-5439-ip>:5678
AI_N8N_SERVICE_TOKEN=your-secure-token
```

## 3. Usage Flow (RAG)
1. User submits a query via the Next.js `RagChatWidget`.
2. Backend validates JWT and creates a BullMQ job on `rag-query-queue`.
3. Worker retrieves the job, injects the `projectPublicId` filter into Qdrant.
4. Worker fetches context, queries Ollama, and streams/returns the response.
