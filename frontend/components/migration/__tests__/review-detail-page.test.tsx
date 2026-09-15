// File: frontend/components/migration/__tests__/review-detail-page.test.tsx
// Change Log:
// - 2026-09-14: T019/T023 (ADR-054) — migrate fixtures to new contract: reviewState.* first-class
//   (fieldResolutions ย้ายออกจาก details), storageTempPath แทน details.source_file_path และ
//   เพิ่ม test ว่า CompareResultTable ได้รับ compareResult/capturedThresholds จาก details
// - 2026-08-31: T041-T045 — เพิ่ม tag accept/reject tests (US3): tag chips render, accept/reject controls,
//   tagDecisions payload excludes rejected tags, evidence included, decision toggle
// - 2026-08-31: T035 — initial RED test for detail page diagnostics (ocrQuality + metadata.confidence as separate sections)
//   Covers T035 (separate sections), T037 (ocrQuality block), T038 (metadata confidence badges),
//   T039 (acknowledge controls wired into commit payload), T040 (422 unresolvedFields inline warnings)

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompareStatus, MigrationReviewStatus, MigrationReviewQueueItem } from '@/types/migration';

// --- Mocks ---

// Mock function declarations — accessed lazily inside vi.mock factory wrappers
// to avoid TDZ errors (vi.mock is hoisted above const declarations)
const mockGetQueueItem = vi.fn();
const mockCommitMutateAsync = vi.fn();
const mockRestoreQueueOcrText = vi.fn();
const mockCompareTableProps = vi.fn();

// Mock next/navigation — override setup mock to provide a specific id
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-uuid-123' }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock migration service — getQueueItem wrapped in a function for lazy access
vi.mock('@/lib/services/migration.service', () => ({
  migrationService: {
    getQueueItem: (id: string) => mockGetQueueItem(id),
    approveQueueItem: vi.fn(),
    rejectQueueItem: vi.fn(),
    startExtractQueueItem: vi.fn(),
    restoreQueueOcrText: (publicId: string, idempotencyKey: string) =>
      mockRestoreQueueOcrText(publicId, idempotencyKey),
  },
}));

// Mock organization service
vi.mock('@/lib/services/organization.service', () => ({
  organizationService: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

// Mock master data service
vi.mock('@/lib/services/master-data.service', () => ({
  masterDataService: {
    getDisciplines: vi.fn().mockResolvedValue([]),
    getCorrespondenceTypes: vi.fn().mockResolvedValue([
      { typeCode: 'RFA', typeName: 'Request for Approval' },
      { typeCode: 'COR', typeName: 'Correspondence' },
    ]),
  },
}));

// Mock commit hook — mutateAsync accessed lazily inside useCommitMigrationReview
vi.mock('@/hooks/use-migration-review', () => ({
  useCommitMigrationReview: () => ({
    mutateAsync: mockCommitMutateAsync,
    isPending: false,
  }),
  useReExtractQueueItem: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

// Mock child components to simplify rendering
vi.mock('@/components/migration/staging-file-viewer', () => ({
  StagingFileViewer: () => <div data-testid="staging-file-viewer" />,
}));
vi.mock('@/components/migration/ocr-text-editor', () => ({
  OcrTextEditor: () => <div data-testid="ocr-text-editor" />,
}));
vi.mock('@/components/migration/compare-result-table', () => ({
  // T023: capture props เพื่อ assert ว่า page ส่ง compareResult/capturedThresholds จาก details
  CompareResultTable: (props: Record<string, unknown>) => {
    mockCompareTableProps(props);
    return <div data-testid="compare-result-table" />;
  },
}));

// Import after mocks (vi.mock is hoisted)
import MigrationReviewPage from '@/app/(admin)/admin/migration/review/[id]/page';

// --- Mock data ---

const mockItem: MigrationReviewQueueItem = {
  publicId: 'test-uuid-123',
  documentNumber: 'DOC-001',
  subject: 'Test Document Subject',
  aiSuggestedCorrespondenceType: 'RFA',
  aiConfidence: 0.65,
  status: MigrationReviewStatus.PENDING_REVIEW,
  aiIssues: [{ message: 'Receiver organization confidence is low' }],
  requiresHumanReview: true,
  ocrQualityConfidence: 0.65,
  details: {
    ocrQuality: {
      confidence: 0.65,
      issues: [
        {
          type: 'GARBLED_TEXT',
          message: 'Some text is garbled and hard to read',
          evidence: '...garbled excerpt from OCR...',
        },
      ],
    },
    metadata: {
      summary: 'AI suggested summary text',
      correspondenceType: 'RFA',
      tags: [
        { name: 'Urgent', isNew: false, evidence: 'urgent keyword found' },
        { name: 'Safety', isNew: true, evidence: 'safety concern mentioned in body' },
      ],
      confidence: { summary: 0.7, correspondenceType: 0.6, tags: 0.8 },
    },
    // ADR-054: details มีเฉพาะ AI output + residual ingestion keys —
    // ไม่มี fieldResolutions/source_file_path อีกต่อไป (assertion โดย omission)
  },
  // ADR-054 (D9, FR-010): review state เป็น first-class field — fieldResolutions ย้ายมาที่นี่
  reviewState: {
    fieldResolutions: [
      { field: 'subject', source: 'EXCEL', finalValue: 'Test Document Subject' },
    ],
    fieldAcknowledgments: ['tags'],
  },
  // ADR-054 (FR-010): path ไฟล์ staging เป็น first-class field (ไม่ใช่ details.source_file_path)
  storageTempPath: '/staging/docs/DOC-001.pdf',
  // ADR-054 (FR-007): OCR backup ที่ restore ได้ — first-class field (ไม่ใช่ใน details)
  ocrTextBak: 'original OCR text before manual edit',
  createdAt: '2026-08-01T00:00:00.000Z',
};

// --- Tests ---

describe('MigrationReviewPage — detail page diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueueItem.mockResolvedValue(mockItem);
    mockCommitMutateAsync.mockResolvedValue({ success: true });
    mockRestoreQueueOcrText.mockResolvedValue({
      publicId: 'test-uuid-123',
      ocrTextLength: 39,
      restored: true,
    });
  });

  // T035: ocrQuality and metadata.confidence rendered as SEPARATE labeled sections
  it('renders ocrQuality section and metadata.confidence section as separate labeled blocks', async () => {
    render(<MigrationReviewPage />);

    // Wait for item to load — h1 renders "Review Document: DOC-001" (split text nodes)
    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // ocrQuality section — distinct block with data-testid
    const ocrQualitySection = screen.getByTestId('ocr-quality-section');
    expect(ocrQualitySection).toBeInTheDocument();

    // metadata.confidence section — distinct block with data-testid
    const metadataConfidenceSection = screen.getByTestId('metadata-confidence-section');
    expect(metadataConfidenceSection).toBeInTheDocument();

    // They must be separate DOM nodes (not nested within each other)
    expect(ocrQualitySection).not.toContain(metadataConfidenceSection);
    expect(metadataConfidenceSection).not.toContain(ocrQualitySection);
  });

  // T035: aiIssues stays a separate section (not merged with ocrQuality)
  it('renders aiIssues as a separate section from ocrQuality', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    const ocrQualitySection = screen.getByTestId('ocr-quality-section');
    const aiIssuesSection = screen.getByTestId('ai-issues-section');

    expect(aiIssuesSection).toBeInTheDocument();
    // aiIssues must NOT be inside ocrQuality section (FR-009, /106 finding I1)
    expect(ocrQualitySection).not.toContain(aiIssuesSection);
  });

  // T037: ocrQuality section shows confidence value and issues with type/message/evidence
  it('renders ocrQuality confidence and issues with type, message, and evidence', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    const ocrQualitySection = screen.getByTestId('ocr-quality-section');

    // Confidence value rendered (0.65 → 65.0%)
    expect(ocrQualitySection).toHaveTextContent('65.0%');

    // Issue type rendered
    expect(ocrQualitySection).toHaveTextContent('GARBLED_TEXT');
    // Issue message rendered
    expect(ocrQualitySection).toHaveTextContent('Some text is garbled and hard to read');
    // Issue evidence rendered
    expect(ocrQualitySection).toHaveTextContent('garbled excerpt from OCR');
  });

  // T038: metadata.confidence badges for summary, category, tags
  it('renders per-field metadata confidence badges for summary, category, and tags', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    const metadataSection = screen.getByTestId('metadata-confidence-section');

    // Summary confidence: 0.7 → 70.0%
    expect(metadataSection).toHaveTextContent('70.0%');
    // Category confidence: 0.6 → 60.0%
    expect(metadataSection).toHaveTextContent('60.0%');
    // Tags confidence: 0.8 → 80.0%
    expect(metadataSection).toHaveTextContent('80.0%');
  });

  // ADR-054 (FR-011): reviewState จาก API hydrate เข้า editor state —
  // ack ที่บันทึกไว้ต้องไหลกลับเข้า commit payload โดยไม่ต้องกดใหม่
  it('hydrates fieldAcknowledgments from reviewState into commit payload', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // fixture ตั้ง reviewState.fieldAcknowledgments = ['tags'] — submit ทันทีโดยไม่กด ack เพิ่ม
    fireEvent.click(screen.getByRole('button', { name: /Execute Import/i }));

    await waitFor(() => {
      expect(mockCommitMutateAsync).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCommitMutateAsync.mock.calls[0][0];
    expect(callArg.fieldAcknowledgments).toContain('tags');
  });

  // T039: acknowledge buttons wire into fieldAcknowledgments commit payload
  it('adds field to fieldAcknowledgments when acknowledge button is clicked and includes it in commit payload', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // Click acknowledge button for ocrQuality
    const ackOcrButton = screen.getByTestId('acknowledge-ocrQuality');
    fireEvent.click(ackOcrButton);

    // Submit the form (click Execute Import button)
    const submitButton = screen.getByRole('button', { name: /Execute Import/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCommitMutateAsync).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCommitMutateAsync.mock.calls[0][0];
    expect(callArg.fieldAcknowledgments).toContain('ocrQuality');
    expect(callArg.publicId).toBe('test-uuid-123');
  });

  // T039: acknowledging summary and category also wires into payload
  it('includes acknowledged summary and category fields in commit payload', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // Acknowledge summary
    fireEvent.click(screen.getByTestId('acknowledge-summary'));
    // Acknowledge category
    fireEvent.click(screen.getByTestId('acknowledge-correspondenceType'));

    // Submit
    const submitButton = screen.getByRole('button', { name: /Execute Import/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCommitMutateAsync).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCommitMutateAsync.mock.calls[0][0];
    expect(callArg.fieldAcknowledgments).toContain('summary');
    expect(callArg.fieldAcknowledgments).toContain('correspondenceType');
  });

  // T040: surfaces 422 unresolvedFields error as inline per-field warnings
  it('shows inline warnings for unresolved fields when commit returns 422', async () => {
    mockCommitMutateAsync.mockRejectedValue({
      error: {
        code: 'UNRESOLVED_FIELDS',
        message: 'Commit blocked — unresolved low-confidence fields: ocrQuality, summary',
        statusCode: 422,
        unresolvedFields: ['ocrQuality', 'summary'],
      },
    });

    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Execute Import/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCommitMutateAsync).toHaveBeenCalledTimes(1);
    });

    // Inline warning should be visible
    await waitFor(() => {
      const warning = screen.getByTestId('unresolved-fields-warning');
      expect(warning).toBeInTheDocument();
      // Should mention the unresolved fields
      expect(warning).toHaveTextContent('ocrQuality');
      expect(warning).toHaveTextContent('summary');
    });
  });

  // T040: surfaces category-invalid error as inline warning on category field
  it('shows inline warning on category field when commit returns category-invalid error', async () => {
    mockCommitMutateAsync.mockRejectedValue({
      error: {
        code: 'CATEGORY_NOT_ALLOWED',
        message: 'Category "INVALID" is not in the allowed correspondence_types.typeCode list',
        statusCode: 422,
      },
    });

    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Execute Import/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCommitMutateAsync).toHaveBeenCalledTimes(1);
    });

    // Category error warning should be visible
    await waitFor(() => {
      const warning = screen.getByTestId('correspondenceType-error-warning');
      expect(warning).toBeInTheDocument();
    });
  });

  // T036: category dropdown is sourced from correspondence_types (already-satisfied verification)
  it('renders category as a dropdown (not free-text input) sourced from correspondence types', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // Category should be a Select (trigger button), not a plain text input
    // The Select trigger is a button with role="combobox"
    const categoryCombobox = screen.getByRole('combobox', { name: /Category/i });
    expect(categoryCombobox).toBeInTheDocument();
  });

  // --- T041-T045: Tag accept/reject UI (US3) ---

  // T042: renders suggested tags as chips with name, isNew badge, and evidence tooltip (FR-006)
  it('renders suggested tags as chips with name, isNew badge, and evidence tooltip', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // Tag suggestions section exists
    const tagsSection = screen.getByTestId('tag-suggestions-section');
    expect(tagsSection).toBeInTheDocument();

    // Both tag names rendered
    expect(tagsSection).toHaveTextContent('Urgent');
    expect(tagsSection).toHaveTextContent('Safety');

    // isNew badge only for the new tag (Safety)
    const newBadge = screen.getByTestId('tag-is-new-badge-Safety');
    expect(newBadge).toBeInTheDocument();
    // Urgent is not new — no isNew badge
    expect(screen.queryByTestId('tag-is-new-badge-Urgent')).not.toBeInTheDocument();

    // Evidence tooltip via title attribute on each chip
    const urgentChip = screen.getByTestId('tag-chip-Urgent');
    expect(urgentChip).toHaveAttribute('title', 'urgent keyword found');
    const safetyChip = screen.getByTestId('tag-chip-Safety');
    expect(safetyChip).toHaveAttribute('title', 'safety concern mentioned in body');
  });

  // T043: accept/reject buttons per tag chip, default pending state
  it('renders accept and reject buttons per tag chip with default pending state', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // Accept and reject buttons for each tag
    expect(screen.getByTestId('tag-accept-Urgent')).toBeInTheDocument();
    expect(screen.getByTestId('tag-reject-Urgent')).toBeInTheDocument();
    expect(screen.getByTestId('tag-accept-Safety')).toBeInTheDocument();
    expect(screen.getByTestId('tag-reject-Safety')).toBeInTheDocument();

    // Default state: both tags pending (no accept/reject highlight)
    const acceptUrgent = screen.getByTestId('tag-accept-Urgent');
    const rejectUrgent = screen.getByTestId('tag-reject-Urgent');
    // Pending = neither button is in the "active/selected" variant
    expect(acceptUrgent).not.toHaveAttribute('data-active', 'true');
    expect(rejectUrgent).not.toHaveAttribute('data-active', 'true');
  });

  // T041 (test seam, corrected during orchestrator review — backend iterates tagDecisions[]
  // directly with no diffing against AI suggestions, so BOTH accepted and rejected decisions
  // must be sent explicitly; omitting rejected entries would silently break the audit trail
  // (FR-008) and permanently deadlock the commit gate if every tag is rejected (FR-014))
  it('includes both accepted and rejected tags in tagDecisions payload with correct accepted flag', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // Accept "Urgent", reject "Safety"
    fireEvent.click(screen.getByTestId('tag-accept-Urgent'));
    fireEvent.click(screen.getByTestId('tag-reject-Safety'));

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Execute Import/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCommitMutateAsync).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCommitMutateAsync.mock.calls[0][0];
    expect(callArg.tagDecisions).toBeDefined();
    expect(Array.isArray(callArg.tagDecisions)).toBe(true);
    // Both the accepted and the rejected tag are in the payload
    expect(callArg.tagDecisions).toHaveLength(2);
    const urgentDecision = callArg.tagDecisions.find(
      (d: { name: string }) => d.name === 'Urgent'
    );
    const safetyDecision = callArg.tagDecisions.find(
      (d: { name: string }) => d.name === 'Safety'
    );
    expect(urgentDecision?.accepted).toBe(true);
    expect(safetyDecision?.accepted).toBe(false);
  });

  // T043/T045: all tags pending → no tagDecisions sent (tags not yet reviewed)
  it('sends empty tagDecisions when no tags are decided (all pending)', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // Do NOT click any accept/reject — all tags remain pending
    const submitButton = screen.getByRole('button', { name: /Execute Import/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCommitMutateAsync).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCommitMutateAsync.mock.calls[0][0];
    // tagDecisions should be undefined or empty (no decisions made)
    if (callArg.tagDecisions) {
      expect(callArg.tagDecisions).toHaveLength(0);
    }
  });

  // T044: accepted tag includes evidence in tagDecisions payload
  it('includes evidence in tagDecisions for accepted tags', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // Accept "Safety" (has evidence)
    fireEvent.click(screen.getByTestId('tag-accept-Safety'));

    const submitButton = screen.getByRole('button', { name: /Execute Import/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCommitMutateAsync).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCommitMutateAsync.mock.calls[0][0];
    expect(callArg.tagDecisions).toHaveLength(1);
    expect(callArg.tagDecisions[0].name).toBe('Safety');
    expect(callArg.tagDecisions[0].accepted).toBe(true);
    expect(callArg.tagDecisions[0].evidence).toBe('safety concern mentioned in body');
  });

  // Regression test (orchestrator review fix): rejecting EVERY suggested tag must still
  // produce a non-empty tagDecisions[] payload — otherwise the commit gate would see tags
  // as never-reviewed and permanently block commit for this item (FR-014 deadlock)
  it('sends non-empty tagDecisions when every suggested tag is rejected', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tag-reject-Urgent'));
    fireEvent.click(screen.getByTestId('tag-reject-Safety'));

    const submitButton = screen.getByRole('button', { name: /Execute Import/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCommitMutateAsync).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCommitMutateAsync.mock.calls[0][0];
    expect(callArg.tagDecisions).toBeDefined();
    expect(callArg.tagDecisions).toHaveLength(2);
    expect(callArg.tagDecisions.every((d: { accepted: boolean }) => d.accepted === false)).toBe(true);
  });

  // T043: toggling decision — accept then reject changes the decision
  it('allows changing decision from accept to reject', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    // First accept Urgent
    fireEvent.click(screen.getByTestId('tag-accept-Urgent'));
    // Then reject Urgent (change mind)
    fireEvent.click(screen.getByTestId('tag-reject-Urgent'));

    const submitButton = screen.getByRole('button', { name: /Execute Import/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCommitMutateAsync).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCommitMutateAsync.mock.calls[0][0];
    // Urgent's final decision is reject (accept→reject toggle) — it IS still sent,
    // with accepted:false (backend needs the explicit decision, not omission — see
    // the "reject all tags" regression test above)
    const urgentDecision = callArg.tagDecisions?.find(
      (d: { name: string }) => d.name === 'Urgent'
    );
    expect(urgentDecision).toBeDefined();
    expect(urgentDecision.accepted).toBe(false);
  });

  // --- T016 (ADR-054, FR-007): Restore OCR เดิม ---

  // T016: ปุ่ม restore แสดงเมื่อ ocrTextBak ไม่ว่าง
  it('renders restore OCR button when ocrTextBak is non-empty', async () => {
    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    expect(screen.getByTestId('restore-ocr-button')).toBeInTheDocument();
  });

  // T016: ปุ่ม restore ซ่อนเมื่อ ocrTextBak เป็น null (ไม่มี backup)
  it('hides restore OCR button when ocrTextBak is null', async () => {
    mockGetQueueItem.mockResolvedValue({ ...mockItem, ocrTextBak: null });

    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('restore-ocr-button')).not.toBeInTheDocument();
  });

  // T016: ปุ่ม restore ซ่อนเมื่อ ocrTextBak เป็น empty string
  it('hides restore OCR button when ocrTextBak is an empty string', async () => {
    mockGetQueueItem.mockResolvedValue({ ...mockItem, ocrTextBak: '' });

    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('restore-ocr-button')).not.toBeInTheDocument();
  });

  // T016: click → confirm → เรียก restoreQueueOcrText ด้วย publicId + idempotency-key → refetch item
  it('calls restoreQueueOcrText with publicId and idempotency key after confirm, then refetches the item', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    try {
      render(<MigrationReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
      });

      // initial fetch เสร็จแล้ว 1 ครั้ง
      expect(mockGetQueueItem).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('restore-ocr-button'));

      await waitFor(() => {
        expect(mockRestoreQueueOcrText).toHaveBeenCalledTimes(1);
      });

      const [calledPublicId, idempotencyKey] = mockRestoreQueueOcrText.mock.calls[0] as [string, string];
      expect(calledPublicId).toBe('test-uuid-123');
      // ADR-016: mutation ต้องส่ง idempotency-key ที่ไม่ว่างเสมอ
      expect(typeof idempotencyKey).toBe('string');
      expect(idempotencyKey.length).toBeGreaterThan(0);

      // refetch เพื่อให้ OcrTextEditor แสดงข้อความที่กู้คืน
      await waitFor(() => {
        expect(mockGetQueueItem).toHaveBeenCalledTimes(2);
      });
    } finally {
      confirmSpy.mockRestore();
    }
  });

  // T016: ยกเลิก confirm → ไม่เรียก service
  it('does not call restoreQueueOcrText when the confirm dialog is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    try {
      render(<MigrationReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/DOC-001/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('restore-ocr-button'));

      expect(mockRestoreQueueOcrText).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  // --- T023 (ADR-054, FR-010): compare data มาจาก details ไม่ใช่ top-level field ---

  // T023: CompareResultTable ต้องได้รับ compareResult/capturedThresholds ที่อ่านจาก
  // item.details (AI output ใน ai_metadata_json) — top-level reads เดิมเป็น always-undefined
  it('passes compareResult and capturedThresholds from item.details to CompareResultTable', async () => {
    const compareResult = {
      fieldResults: [
        {
          field: 'documentNumber',
          excelValue: 'DOC-001',
          ocrValue: 'DOC-001',
          match: true,
          foundInDocument: true,
        },
      ],
      mismatches: [],
      confidence: 0.9,
    };
    const capturedThresholds = { maxMismatchFields: 3, minConfidence: 0.7 };
    mockGetQueueItem.mockResolvedValue({
      ...mockItem,
      compareStatus: CompareStatus.COMPARED,
      details: {
        ...(mockItem.details as Record<string, unknown>),
        compareResult,
        capturedThresholds,
      },
    });

    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId('compare-result-table')).toBeInTheDocument();
    });

    const props = mockCompareTableProps.mock.calls[0][0] as {
      compareResult?: unknown;
      capturedThresholds?: unknown;
    };
    expect(props.compareResult).toEqual(compareResult);
    expect(props.capturedThresholds).toEqual(capturedThresholds);
  });

  // T023: item ที่ไม่มี details.compareResult → CompareResultTable ได้ compareResult=undefined
  // (ไม่พัง — component มี fallback "ไม่มีข้อมูลการเปรียบเทียบ")
  it('passes undefined compareResult when details.compareResult is absent', async () => {
    mockGetQueueItem.mockResolvedValue({
      ...mockItem,
      compareStatus: CompareStatus.COMPARED,
    });

    render(<MigrationReviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId('compare-result-table')).toBeInTheDocument();
    });

    const props = mockCompareTableProps.mock.calls[0][0] as {
      compareResult?: unknown;
      capturedThresholds?: unknown;
    };
    expect(props.compareResult).toBeUndefined();
    expect(props.capturedThresholds).toBeUndefined();
  });
});
