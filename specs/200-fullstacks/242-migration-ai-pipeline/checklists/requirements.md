// File: specs/200-fullstacks/242-migration-ai-pipeline/checklists/requirements.md
// Change Log:
// - 2026-08-06: Initial specification quality checklist

# Specification Quality Checklist: Migration AI Pipeline Refactor

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Validation Notes

### Iteration 1 — Issues found and fixed

| Issue | Resolution |
| --- | --- |
| Draft FRs referenced concrete tech (`attachments.ocr_text`, BullMQ queue names, `POST /api/migration/...`, Qdrant, `mime_type`) | Rewrote all 30 FRs in outcome language — "จัดเก็บข้อความไว้ถาวรกับไฟล์แนบนั้น" instead of naming the column; "กระบวนการแบบชุด" instead of naming endpoints |
| Draft SCs used technical metrics (embedding count vs Qdrant point count) | Replaced with user-facing metrics — SC-007 measures coverage %, SC-008 measures search response time from user perspective |
| "AI Compare" / "RAG embedding" leaked implementation vocabulary into user stories | Reframed as "การเปรียบเทียบทะเบียนกับเอกสารจริง" and "การค้นหาเชิงความหมาย" — the user-observable behaviour |
| Missing edge cases for compare-step failure modes | Added: empty/too-short document text, unreadable compare response, duplicate batch runs, missing attachment on confirm, shared attachment across correspondences |
| No explicit non-goal boundary | Added **Out of Scope** section (5 items) to bound the feature against production flow and post-migration cleanup |

### Clarifications resolved without asking

Per skill guidance (max 3 markers, informed guesses preferred), these were resolved as documented assumptions rather than blocking questions:

| Ambiguity | Decision | Rationale |
| --- | --- | --- |
| Which is source of truth when register and document disagree? | Excel register is source of truth; compare result is advisory only (FR-011) | Register is the curated project index; reviewer retains final say — matches ADR-028 human-in-the-loop principle |
| Which attachment is the main document? | First attachment in the list, unless specified otherwise (FR-002) | No ordering signal exists in legacy register; first-is-main is the conventional default |
| Should semantic search be available during migration? | No — batch after migration completes (FR-026) | No end users active during migration window; avoids resource contention (recorded in Assumptions) |
| Do construction drawing files participate in semantic search? | No — skipped (FR-022) | Legacy drawing files have no readable text layer (recorded in Assumptions) |

## Status

**PASS** — all checklist items satisfied after 1 iteration. Spec is ready for `/103-speckit.clarify`.
