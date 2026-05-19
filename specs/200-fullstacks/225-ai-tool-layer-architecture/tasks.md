# Implementation Tasks: AI Tool Layer Architecture

**Feature Branch**: `225-ai-tool-layer-architecture`  
**Created**: 2026-05-19  
**Updated**: 2026-05-19 (Implementation complete)

## Task Strategy

Implementation of the Server-Side Tool Layer. This will be integrated into the existing `AiModule` but isolated in a `AiToolModule` submodule. All tests must verify CASL restrictions and payload format mapping.

## Phase 1: Core Framework (Tool Registry & Base Types)

- [X] **1.1: Define Core Types**
  - **File**: `backend/src/modules/ai/tool/types/tool-call-result.type.ts`
  - **Action**: Implement `ToolCallReason` and `ToolCallResult<T>` as defined in the contract.
  - **Verification**: Type-checks pass.

- [X] **1.2: Implement Tool Registry Service**
  - **File**: `backend/src/modules/ai/tool/ai-tool-registry.service.ts`
  - **Action**: Create a service with a static map connecting `ServerIntent` to their corresponding handler functions.
  - **Verification**: Unit tests verify that calling `getHandler(intent)` returns the correct function or throws a clean error if not found.

- [X] **1.3: Set up AiToolModule**
  - **File**: `backend/src/modules/ai/tool/ai-tool.module.ts`
  - **Action**: Scaffold the module, export `AiToolRegistryService`, and import it into `AiModule`.
  - **Verification**: Application boots successfully.

## Phase 2: Implement Tool Handlers

- [X] **2.1: Implement RFA Tool Service**
  - **File**: `backend/src/modules/ai/tool/rfa-tool.service.ts`
  - **Action**: Implement `getRfa` using `RfaService`. Wrap in CASL check (`AbilityFactory`). Return mapped `RfaToolResult`.
  - **Verification**: Unit tests confirm unauthorized users receive `{ ok: false, reason: 'FORBIDDEN' }`, and authorized users receive `{ ok: true, data: [...] }` without `id`.

- [X] **2.2: Implement Drawing Tool Service**
  - **File**: `backend/src/modules/ai/tool/drawing-tool.service.ts`
  - **Action**: Implement `getDrawing` using `ShopDrawingService`. Wrap in CASL check. Return mapped `DrawingToolResult`.
  - **Verification**: Tests confirm `DrawingToolResult` complies with ADR-019.

- [X] **2.3: Implement Transmittal Tool Service**
  - **File**: `backend/src/modules/ai/tool/transmittal-tool.service.ts`
  - **Action**: Implement `getTransmittal` with CASL check.
  - **Verification**: Tests confirm CASL enforcement.

## Phase 3: Integration and Audit Logging

- [X] **3.1: Integrate Audit Logging**
  - **File**: `backend/src/modules/ai/tool/ai-tool-registry.service.ts`
  - **Action**: Add logic to write to `ai_audit_logs` (using AuditLog entity directly) for every tool execution.
  - **Verification**: Integration test shows DB row created after tool execution.

- [X] **3.2: Expose Endpoint / Update AI Gateway**
  - **File**: `backend/src/modules/ai/ai.controller.ts`
  - **Action**: Wire up the `AiToolRegistryService` dispatch within the `POST /ai/intent` handler.
  - **Verification**: E2E test making an intent request and getting a mapped response back.
