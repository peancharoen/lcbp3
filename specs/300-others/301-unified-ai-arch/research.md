# Technical Research: Unified AI Architecture

**Feature**: Unified AI Architecture (ADR-023)
**Date**: 2026-05-14

## Unknown 1: Integration Auth for n8n AI Pipeline
**Decision**: Create a dedicated `ServiceAccount` API token mechanism for n8n to communicate with the DMS Backend API.
**Rationale**: n8n runs on the isolated AI Host (Desk-5439) and requires programmatic access to upload legacy documents and update staging queue statuses. Standard user JWTs expire too quickly, so a long-lived, restricted-scope service account token is required.
**Alternatives considered**: 
- Using a standard Admin user account (rejected due to token expiry and audit trail mingling).
- Unauthenticated internal webhook (rejected due to ADR-016 Zero Trust policy).

## Unknown 2: Qdrant Multi-tenant Payload Filters
**Decision**: Enforce `project_public_id` natively at the NestJS `QdrantService` layer for every search query.
**Rationale**: Ensures that RAG queries absolutely cannot leak data across projects, satisfying SC-004. The backend will automatically inject the user's currently active project ID into the Qdrant filter condition before executing the search.
**Alternatives considered**:
- Having the LLM filter the context (rejected due to high risk of hallucination and leakage).

## Unknown 3: BullMQ RAG Queue Configuration
**Decision**: Implement a dedicated `rag-query-queue` in BullMQ with a concurrency limit of `1`.
**Rationale**: The local LLM (gemma4:9b) on Desk-5439 has limited VRAM (8GB). Processing more than one RAG query at a time will cause Out-Of-Memory (OOM) crashes. Queuing guarantees stability.
**Alternatives considered**:
- Load balancing across multiple GPUs (rejected: hardware constraints, only one RTX 2060 Super available).

## Unknown 4: UI/UX for Graceful AI Fallback
**Decision**: Use React Context (`AiStatusProvider`) in Next.js to globally distribute the AI Host health status. If offline, AI-specific form fields (like auto-suggest chips) and the RAG Chat widget will conditionally render a disabled state or hide entirely.
**Rationale**: Provides a seamless graceful degradation experience without requiring individual components to implement repetitive health-check logic.
