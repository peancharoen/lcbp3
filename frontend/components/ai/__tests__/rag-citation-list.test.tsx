// File: frontend/components/ai/__tests__/rag-citation-list.test.tsx
// Change Log:
// - 2026-09-12: สร้าง Unit Test สำหรับ RagCitationList (Feature 254, Phase 4 US2, T044)
// - 2026-09-15: เพิ่ม test สำหรับ sourceLocator breadcrumb และ segmentType badge
//   (Feature 254, Phase 6 US4, T062) — รองรับ non-page source types
//   (SECTION/SHEET/WHOLE_DOCUMENT) และ ZIP inner-file sourceLocator

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RagCitationList } from '../rag-citation-list';
import type { RagCitation, RagRetrievalMode } from '@/hooks/use-rag-query';

/** สร้าง citation ตัวอย่างตาม contract rag-retrieval.md */
function makeCitation(overrides: Partial<RagCitation> = {}): RagCitation {
  return {
    attachmentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
    ownerType: 'CORRESPONDENCE',
    ownerPublicId: '019505a1-7c3e-7000-8000-owner0000001',
    sourceLocator: 'drawing.pdf',
    segmentType: 'PAGE',
    segmentNumber: 3,
    segmentLabel: 'Page 3',
    startOffset: '120',
    endOffset: '640',
    snippet: 'This is the approved revision of the drawing.',
    score: 0.91,
    chunkPublicId: '019505a1-7c3e-7000-8000-chunk0000001',
    ...overrides,
  };
}

describe('RagCitationList', () => {
  it('แสดง retrievalMode badge VECTOR', () => {
    render(
      <RagCitationList
        sources={[makeCitation()]}
        retrievalMode="VECTOR"
      />
    );
    expect(screen.getByText('VECTOR')).toBeInTheDocument();
  });

  it('แสดง retrievalMode badge สำหรับ fallback mode (FULL_TEXT)', () => {
    render(
      <RagCitationList
        sources={[makeCitation()]}
        retrievalMode="FULL_TEXT"
      />
    );
    expect(screen.getByText('FULL_TEXT')).toBeInTheDocument();
  });

  it('แสดง retrievalMode badge HYBRID', () => {
    render(
      <RagCitationList
        sources={[makeCitation()]}
        retrievalMode="HYBRID"
      />
    );
    expect(screen.getByText('HYBRID')).toBeInTheDocument();
  });

  it('แสดง attachmentPublicId ของแต่ละ citation', () => {
    const citation = makeCitation({
      attachmentPublicId: '019505a1-7c3e-7000-8000-attach00001',
    });
    render(
      <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
    );
    expect(
      screen.getByText('019505a1-7c3e-7000-8000-attach00001')
    ).toBeInTheDocument();
  });

  it('แสดง segment info (segmentLabel) ของ citation', () => {
    const citation = makeCitation({
      segmentLabel: 'Page 5',
      segmentType: 'PAGE',
      sourceLocator: undefined,
    });
    render(
      <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
    );
    // segmentLabel แสดงเป็น breadcrumb เมื่อไม่มี sourceLocator
    expect(screen.getByText('Page 5')).toBeInTheDocument();
  });

  it('แสดง snippet ของ citation', () => {
    const citation = makeCitation({
      snippet: 'The latest approved revision is Rev C.',
    });
    render(
      <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
    );
    expect(
      screen.getByText('The latest approved revision is Rev C.')
    ).toBeInTheDocument();
  });

  it('แสดง score ของ citation เป็นเปอร์เซ็นต์', () => {
    const citation = makeCitation({ score: 0.91 });
    render(
      <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
    );
    expect(screen.getByText('91.0%')).toBeInTheDocument();
  });

  it('แสดงหลาย citation พร้อมกัน', () => {
    const sources = [
      makeCitation({
        chunkPublicId: '019505a1-7c3e-7000-8000-chunk0000001',
        snippet: 'First source snippet.',
      }),
      makeCitation({
        chunkPublicId: '019505a1-7c3e-7000-8000-chunk0000002',
        snippet: 'Second source snippet.',
        score: 0.75,
      }),
    ];
    render(<RagCitationList sources={sources} retrievalMode="HYBRID" />);
    expect(screen.getByText('First source snippet.')).toBeInTheDocument();
    expect(screen.getByText('Second source snippet.')).toBeInTheDocument();
    expect(screen.getByText('91.0%')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('ไม่แสดง generationUuid ในผลลัพธ์ (ADR-019 publicId เท่านั้น)', () => {
    const citation = makeCitation();
    const { container } = render(
      <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
    );
    // generationUuid ต้องไม่ปรากฏใน DOM ทั้งหมด
    expect(container.textContent).not.toContain('generationUuid');
    expect(screen.queryByText(/generationUuid/i)).not.toBeInTheDocument();
  });

  it('แสดงข้อความเมื่อไม่มี citation', () => {
    render(<RagCitationList sources={[]} retrievalMode="VECTOR" />);
    // ควรมีข้อความบอกว่าไม่มีเอกสารอ้างอิง
    expect(screen.getByText(/ไม่มีเอกสารอ้างอิง/i)).toBeInTheDocument();
  });

  it('แสดง sourceLocator เมื่อมี', () => {
    const citation = makeCitation({
      sourceLocator: 'drawing-rev-c.pdf',
      segmentLabel: undefined,
    });
    render(
      <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
    );
    // sourceLocator แสดงเป็น breadcrumb เมื่อไม่มี segmentLabel
    expect(screen.getByText('drawing-rev-c.pdf')).toBeInTheDocument();
  });

  it('รับ props ตาม type RagRetrievalMode ทั้งสามค่า', () => {
    const modes: RagRetrievalMode[] = ['VECTOR', 'FULL_TEXT', 'HYBRID'];
    for (const mode of modes) {
      const { unmount } = render(
        <RagCitationList sources={[makeCitation()]} retrievalMode={mode} />
      );
      expect(screen.getByText(mode)).toBeInTheDocument();
      unmount();
    }
  });

  describe('segmentType badge (T062)', () => {
    it('แสดง segmentType badge PAGE', () => {
      const citation = makeCitation({ segmentType: 'PAGE' });
      render(
        <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
      );
      expect(screen.getByText('PAGE')).toBeInTheDocument();
    });

    it('แสดง segmentType badge SECTION', () => {
      const citation = makeCitation({
        segmentType: 'SECTION',
        segmentLabel: 'Section 2',
      });
      render(
        <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
      );
      expect(screen.getByText('SECTION')).toBeInTheDocument();
    });

    it('แสดง segmentType badge SHEET', () => {
      const citation = makeCitation({
        segmentType: 'SHEET',
        segmentLabel: 'Sheet 1',
      });
      render(
        <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
      );
      expect(screen.getByText('SHEET')).toBeInTheDocument();
    });

    it('แสดง segmentType badge WHOLE_DOCUMENT', () => {
      const citation = makeCitation({
        segmentType: 'WHOLE_DOCUMENT',
        segmentLabel: undefined,
        segmentNumber: undefined,
      });
      render(
        <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
      );
      expect(screen.getByText('WHOLE_DOCUMENT')).toBeInTheDocument();
    });
  });

  describe('sourceLocator breadcrumb (T062)', () => {
    it('แสดง sourceLocator เป็น breadcrumb เมื่อมี segmentLabel', () => {
      const citation = makeCitation({
        sourceLocator: 'docs/spec.pdf',
        segmentLabel: 'Page 3',
        segmentType: 'PAGE',
      });
      render(
        <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
      );
      // breadcrumb format: "docs/spec.pdf → Page 3"
      expect(
        screen.getByText('docs/spec.pdf → Page 3')
      ).toBeInTheDocument();
    });

    it('แสดง sourceLocator สำหรับ ZIP inner file เป็น breadcrumb', () => {
      const citation = makeCitation({
        sourceLocator: 'archive.zip → inner.pdf',
        segmentLabel: 'Section 2',
        segmentType: 'SECTION',
      });
      render(
        <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
      );
      // breadcrumb format: "archive.zip → inner.pdf → Section 2"
      expect(
        screen.getByText('archive.zip → inner.pdf → Section 2')
      ).toBeInTheDocument();
    });

    it('แสดง sourceLocator เพียงอย่างเดียวเมื่อไม่มี segmentLabel', () => {
      const citation = makeCitation({
        sourceLocator: 'drawing.pdf',
        segmentLabel: undefined,
        segmentType: 'WHOLE_DOCUMENT',
      });
      render(
        <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
      );
      expect(screen.getByText('drawing.pdf')).toBeInTheDocument();
      // ไม่ควรมีลูกศร breadcrumb ท้าย
      expect(screen.queryByText(/drawing.pdf →/)).not.toBeInTheDocument();
    });

    it('แสดง segmentLabel เพียงอย่างเดียวเมื่อไม่มี sourceLocator', () => {
      const citation = makeCitation({
        sourceLocator: undefined,
        segmentLabel: 'Page 7',
        segmentType: 'PAGE',
      });
      render(
        <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
      );
      expect(screen.getByText('Page 7')).toBeInTheDocument();
    });

    it('ไม่แสดง breadcrumb เมื่อไม่มีทั้ง sourceLocator และ segmentLabel', () => {
      const citation = makeCitation({
        sourceLocator: undefined,
        segmentLabel: undefined,
        segmentType: 'WHOLE_DOCUMENT',
      });
      const { container } = render(
        <RagCitationList sources={[citation]} retrievalMode="VECTOR" />
      );
      // ไม่ควรมีลูกศร breadcrumb ใด ๆ
      expect(container.textContent).not.toContain('→');
    });
  });

  describe('generationUuid ไม่ปรากฏ (T062 regression)', () => {
    it('ไม่แสดง generationUuid แม้มี sourceLocator และ segmentType', () => {
      const citation = makeCitation({
        sourceLocator: 'archive.zip → inner.pdf',
        segmentType: 'SECTION',
        segmentLabel: 'Section 2',
      });
      const { container } = render(
        <RagCitationList sources={[citation]} retrievalMode="HYBRID" />
      );
      expect(container.textContent).not.toContain('generationUuid');
      expect(screen.queryByText(/generationUuid/i)).not.toBeInTheDocument();
    });
  });
});
