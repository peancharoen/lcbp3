// File: specs/200-fullstacks/250-ai-metadata-extraction-contract/spec.md
// Change Log:
// - 2026-08-31: Initial specification for AI Metadata Extraction Output Contract (derived from ADR-050 grill session)

# Feature Specification: AI Metadata Extraction Output Contract

**Feature Branch**: `250-ai-metadata-extraction-contract` (no git branch created — working on `main` per explicit request)
**Created**: 2026-08-31
**Status**: Draft
**Category**: 200-fullstacks
**Input**: User description: "implement the AI metadata extraction output contract refactor per ADR-050 (specs/06-Decision-Records/ADR-050-ai-metadata-extraction-output-contract.md) and docs/ai-prompt-refactor-20260831.md — new ocrQuality + per-field metadata.confidence + requiresHumanReview JSON contract from np-dms-ai metadata extraction step, category sourced from correspondence_types master data, tags as {name,isNew,evidence}[] with accept/reject UI + audit trail, backend processLegacyAiEnrichment refactored to use Active Prompt (ocr_extraction) instead of hardcoded prompt, and frontend migration review queue table + detail page updated to surface the new fields (filter/sort by requiresHumanReview, category dropdown, tag accept/reject chips, ocrQuality section)."

## Clarifications

### Session 2026-08-31

- Q: When an item is flagged `requiresHumanReview = true`, how should the system gate committing it? → A: Block commit until the reviewer explicitly resolves the flag (by editing the flagged field(s) or providing an explicit low-confidence acknowledgment).
- Q: If `requiresHumanReview` was triggered by a specific low-confidence field (e.g. tags), does editing an unrelated field (e.g. summary) clear the flag, or must the reviewer address the specific low-confidence field(s)? → A: Resolution is tracked per triggering field — the reviewer must edit or explicitly acknowledge each field that fell below the confidence threshold before commit is unblocked; fixing an unrelated field does not clear the flag.
- Q: For legacy queue items that need re-processing (FR-011) before they can be reviewed under the new contract, who triggers that re-processing? → A: Legacy items remain visible in the queue, but the reviewer must trigger re-extraction on that specific item before they can open it for review — no separate bulk/admin-only re-processing flow.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reviewer scans the queue for items that need attention (Priority: P1)

An admin reviewing migrated documents opens the migration review queue and needs to quickly tell which items the AI is confident about (can be skimmed/approved fast) versus which items need careful human review, without opening every single item.

**Why this priority**: This is the highest-leverage change — it directly reduces reviewer time spent opening low-value items and prevents low-confidence items from being rubber-stamped. Without this, the rest of the feature (richer per-item detail) has no entry point.

**Independent Test**: Can be fully tested by loading the review queue with a mix of high- and low-confidence items, confirming items needing review are visually distinguishable, and confirming the queue can be filtered/sorted to surface them first.

**Acceptance Scenarios**:

1. **Given** the review queue contains items with varying AI confidence, **When** the reviewer opens the queue list, **Then** each item clearly indicates whether it requires human review.
2. **Given** the reviewer wants to work through only the risky items first, **When** they apply the "needs review" filter, **Then** only items flagged as requiring review are shown.
3. **Given** the reviewer wants to triage by document-readability, **When** they sort the queue by OCR quality, **Then** items are ordered from worst to best (or vice versa) OCR quality.
4. **Given** a queue item is flagged as requiring human review, **When** the reviewer attempts to commit it without resolving the flag, **Then** the commit is blocked until they either edit the flagged field(s) or explicitly acknowledge proceeding despite low confidence.

---

### User Story 2 - Reviewer distinguishes "hard to read" from "hard to classify" (Priority: P2)

When opening a single queue item, the reviewer needs to understand *why* it needs review: is the scanned text garbled/unreadable, or is the text clear but the AI is unsure about the summary/category/tags it produced? These require different corrective actions (re-scan/re-OCR vs. manually correcting metadata).

**Why this priority**: Builds on Story 1 by giving the reviewer the diagnostic detail needed to act correctly once they've opened a flagged item. Without this, the reviewer still has to guess why an item was flagged.

**Independent Test**: Can be fully tested by opening a queue item detail page and confirming OCR readability quality and per-field (summary/category/tags) confidence are shown as clearly separate, independently-labeled indicators.

**Acceptance Scenarios**:

1. **Given** a queue item whose scanned text is garbled, **When** the reviewer opens its detail page, **Then** the OCR quality indicator is low and any readability issues found are listed with a description and a text excerpt as evidence.
2. **Given** a queue item whose text is readable but whose suggested category is uncertain, **When** the reviewer opens its detail page, **Then** the category confidence is shown separately from the OCR quality and from the summary/tags confidence.

---

### User Story 3 - Reviewer accepts or rejects each suggested tag individually (Priority: P3)

The AI suggests a set of tags for a document, some of which are new tags not yet in the system. The reviewer needs to accept or reject each suggested tag on its own, see why the AI proposed it, and have that decision recorded for later reference.

**Why this priority**: Improves reviewer speed and trust for a specific, frequently-used part of the review flow, but the queue is usable end-to-end (Stories 1-2) without this — tags could otherwise be reviewed as a single edited list.

**Independent Test**: Can be fully tested by opening a queue item with several suggested tags (some new, some existing), accepting some and rejecting others, submitting the review, and confirming only accepted tags are applied to the document while rejected tags are recorded with the reviewer's decision.

**Acceptance Scenarios**:

1. **Given** a queue item has AI-suggested tags, **When** the reviewer views them, **Then** each tag shows whether it is new to the system and the excerpt of document text that justifies it.
2. **Given** the reviewer rejects a suggested tag, **When** they submit their review, **Then** that tag is not applied to the document and the rejection is retrievable later (who rejected it, when, and what was suggested).

---

### Edge Cases

- What happens when the AI's output fails validation (e.g., a confidence value outside the valid range, or a suggested category that isn't in the approved list)? The item must be flagged as needing manual attention, and the reviewer must be able to see that extraction failed rather than silently showing broken data.
- What happens to queue items that were processed before this feature existed (old-format results, missing the new confidence breakdown)? They remain visible in the queue but are not reviewable until the reviewer triggers re-extraction on that item; the review experience does not need to support the old format side-by-side.
- What happens when a document has no readable text at all (OCR produced nothing)? It must be flagged as requiring human review by default, since no confidence score can be meaningfully computed.
- What happens when the AI suggests a tag that already exists but with different casing/spacing? It must be treated as an existing tag (not marked "new") so reviewers aren't asked to approve duplicate tags.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST evaluate and expose two distinct confidence signals for each processed queue item: how readable/well-formed the scanned text is, and how confident the AI is in each extracted metadata field (summary, category, tags) individually.
- **FR-002**: System MUST determine — on its own, not by trusting the AI's self-assessment — whether a queue item requires human review, based on the confidence signals in FR-001.
- **FR-003**: System MUST let reviewers filter the review queue to show only items that require human review.
- **FR-004**: System MUST let reviewers sort the review queue by OCR/text-quality.
- **FR-005**: System MUST restrict the AI-suggested document category to the set of categories the organization has already approved and configured, and MUST NOT allow a category outside that set to be suggested or saved.
- **FR-006**: System MUST present each AI-suggested tag individually with: its name, whether it is new to the system, and a supporting excerpt from the document text.
- **FR-007**: System MUST let reviewers accept or reject each suggested tag independently before committing the review.
- **FR-008**: System MUST record who rejected a suggested tag, when, and what was suggested, so the decision can be reviewed later.
- **FR-009**: System MUST distinguish, in what it shows the reviewer, between problems caused by illegible/garbled source text and problems caused by uncertain business classification (summary/category/tags) — these must not be presented as the same kind of issue.
- **FR-010**: System MUST flag a queue item as failed/needing manual attention when the AI's output does not conform to the expected structure or value ranges, rather than silently accepting invalid data.
- **FR-011**: System MUST NOT allow a queue item processed before this feature existed to be reviewed using the old, less-detailed information. Such legacy items remain visible in the queue in an unreviewable state, and the reviewer MUST be able to trigger re-extraction on that specific item — after which it becomes reviewable under the new contract. No separate bulk or admin-only re-processing flow is required.
- **FR-012**: System MUST only commit a document's category and tags for actual use in the system after a reviewer has explicitly reviewed the AI suggestions (human-in-the-loop) — the AI's raw output must never be applied automatically.
- **FR-013**: System MUST block committing a queue item while it is flagged as requiring human review, until the reviewer either edits the flagged field(s) or provides an explicit acknowledgment to proceed despite low confidence.
- **FR-014**: System MUST track which specific field(s) (OCR quality, summary, category, or tags) triggered the human-review requirement, and MUST require the reviewer to edit or explicitly acknowledge each triggering field individually — resolving one field MUST NOT clear the requirement for a different, unaddressed low-confidence field.

### Key Entities _(include if feature involves data)_

- **Migration Queue Item**: A document imported for review; carries the extraction results below plus its overall review/commit status. Tracks, per low-confidence field (OCR quality, summary, category, tags), whether the reviewer has resolved (edited or acknowledged) that specific field — commit is blocked until every triggering field is resolved.
- **OCR Quality Assessment**: A confidence score describing how readable/continuous the scanned text is, plus a list of specific readability issues found (each with a type, description, and text excerpt).
- **Extracted Metadata**: The AI's proposed summary, category, and tags for the document, plus a separate confidence score per field (summary, category, tags).
- **Tag Suggestion**: An individual proposed tag with its name, whether it's new to the system, and the text excerpt that justifies it; carries the reviewer's accept/reject decision once reviewed.
- **Review Decision Record**: An audit entry capturing what a reviewer accepted or rejected (particularly tag rejections) and when, for later reference.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Reviewers can identify which queue items need attention directly from the queue list, without opening each item individually.
- **SC-002**: 100% of queue items presented for review show OCR/text-quality and metadata confidence as separately labeled indicators (never merged into a single ambiguous score).
- **SC-003**: 0% of committed documents end up with a category outside the organization's approved category list.
- **SC-004**: 100% of rejected tag suggestions have a retrievable record of who rejected them and why (supporting evidence shown at decision time).
- **SC-005**: 100% of queue items with invalid/malformed AI output are visibly flagged as needing manual attention rather than silently showing incomplete or incorrect metadata.
- **SC-006**: 0% of queue items processed before this feature existed are reviewable through the updated flow without first being re-processed.
- **SC-007**: 0% of queue items are committed while still flagged as requiring human review without an explicit reviewer resolution or acknowledgment.
