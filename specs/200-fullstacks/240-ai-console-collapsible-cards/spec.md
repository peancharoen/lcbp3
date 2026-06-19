// File: specs/200-fullstacks/240-ai-console-collapsible-cards/spec.md
// Change Log:
// - 2026-06-19: Initial specification for AI Console Collapsible Cards (Feature 240)

# Feature Specification: AI Console Collapsible Cards

**Feature Branch**: `[240-ai-console-collapsible-cards]`  
**Created**: 2026-06-19  
**Status**: Draft  
**Input**: User request: "/01-speckit.prepare นำ Project ID: 6165107555700812297 Screensช=AI Console with Fixed Collapsible Cards\" มาปรับปรุง หน้า /admin/ai"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Master Collapse for Monitoring Section (Priority: P1)

As a Superadmin, I want to be able to collapse the entire AI Infrastructure Monitoring section, so that I can free up significant vertical screen space when I am testing the RAG Playground or Pipeline Sandbox.

**Why this priority**: The health monitoring section occupies a large portion of the viewport. During active testing, the admin might want to focus entirely on the playground or sandbox tabs without scrolling past the health cards.

**Independent Test**: Can be fully tested by clicking the master collapse button in the "AI Engine Infrastructure Monitoring" header and verifying that the entire grid of monitoring cards transitions smoothly to collapsed (invisible/height 0) and back.

**Acceptance Scenarios**:

1. **Given** I am on the AI Console page, **When** I click the master collapse button (chevron-up) in the "AI Engine Infrastructure Monitoring" header, **Then** the entire monitoring section collapses smoothly with a transition effect, and the icon changes to a chevron-down.
2. **Given** the monitoring section is collapsed, **When** I click the master collapse button again, **Then** the section expands back to its original layout smoothly.
3. **Given** the monitoring section is collapsed, **When** I navigate between tabs, **Then** the collapsed state remains preserved.

---

### User Story 2 - Individual Card Collapse (Priority: P2)

As a Superadmin, I want to collapse individual monitoring cards (e.g., Qdrant, OCR Sidecar, BullMQ, VRAM) while keeping others visible, so that I can customize my monitoring dashboard and focus only on specific systems during troubleshooting.

**Why this priority**: Sometimes an administrator is only debugging one component (e.g., BullMQ queues) and wants to keep it expanded while collapsing other cards to reduce visual clutter.

**Independent Test**: Can be fully tested by clicking the collapse chevron inside an individual card (e.g., Ollama) and verifying that only the body content of that card collapses, while the card header and status badge remain visible.

**Acceptance Scenarios**:

1. **Given** I am viewing the monitoring cards, **When** I click the collapse button inside the Ollama AI Engine card, **Then** the details inside the Ollama card collapse smoothly, but the card header (title and status badge) remains visible.
2. **Given** an individual card body is collapsed, **When** I click the collapse button in that card again, **Then** the details expand back to their original size.
3. **Given** I click the master collapse button, **Then** the entire monitoring section is hidden regardless of individual card collapse states.

---

### Edge Cases

- **Persistence of Collapsed States**: Collapsed states should persist in local storage so that they do not reset when the page is refreshed or when navigating away and returning.
- **TanStack Query Polling Performance**: Collapsing a card or the entire section should NOT stop or duplicate the background polling for health status, ensuring that if a card is re-expanded, it instantly shows the latest status.
- **OOM Guard / Critical Warning Alert Visibility**: If a card is collapsed but a critical error/warning occurs (such as VRAM OOM Guard triggering), the status badge in the card header must clearly reflect this, so the user is alerted even if details are collapsed.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a master toggle button (chevron icon) in the "AI Engine Infrastructure Monitoring" section header.
- **FR-002**: The master collapse transition MUST use CSS transitions (`max-height`, `opacity`, `overflow: hidden`) for a smooth animation effect.
- **FR-003**: The system MUST display a collapse toggle button (chevron icon) next to the status badge in each monitoring card header (Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM).
- **FR-004**: Each individual card's body (`card-body` or equivalent) MUST transition smoothly when collapsed/expanded.
- **FR-005**: The collapsed state (both master section and individual cards) MUST be stored in `localStorage` and restored on page load.
- **FR-006**: When a card is collapsed, the header (title and status badge) MUST remain visible to provide high-level health status at a glance.
- **FR-007**: Changing tab selection (System Toggle, RAG Playground, 3-Step Pipeline Sandbox) MUST NOT reset the collapsed/expanded states.

### Key Entities

No database or backend entities are changed. The states are managed locally on the client.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The entire monitoring section can be collapsed in a single click, reducing the vertical space occupied by the section from ~400px to ~60px.
- **SC-002**: Individual cards can be collapsed independently, and their collapse state persists across page reloads (100% persistence).
- **SC-003**: Polling requests for system health and VRAM usage continue to run in the background at the designated interval (15-30s) even when collapsed.
- **SC-004**: Transitions are smooth, taking no more than 300ms to complete.
