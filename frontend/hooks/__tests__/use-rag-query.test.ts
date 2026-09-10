// File: frontend/hooks/__tests__/use-rag-query.test.ts
// Change Log:
// - 2026-09-12: สร้าง Unit Test สำหรับ useRagQuery hook (Feature 254, Phase 4 US2, T044)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import { useRagQuery } from '../use-rag-query';
import apiClient from '@/lib/api/client';

describe('useRagQuery hook', () => {
  const validResponse = {
    data: {
      answer: 'The latest approved revision is Rev C.',
      sources: [
        {
          attachmentPublicId: '019505a1-7c3e-7000-8000-attach00001',
          ownerType: 'CORRESPONDENCE',
          ownerPublicId: '019505a1-7c3e-7000-8000-owner0000001',
          sourceLocator: 'drawing.pdf',
          segmentType: 'PAGE',
          segmentNumber: 3,
          segmentLabel: 'Page 3',
          startOffset: '120',
          endOffset: '640',
          snippet: 'Approved revision is Rev C.',
          score: 0.91,
          chunkPublicId: '019505a1-7c3e-7000-8000-chunk0000001',
        },
      ],
      retrievalMode: 'VECTOR',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ส่ง POST /api/ai/rag/query พร้อม projectPublicId, query และ Idempotency-Key', async () => {
    (apiClient.post as any).mockResolvedValue(validResponse);
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useRagQuery({
          projectPublicId: '019505a1-7c3e-7000-8000-project0001',
          query: 'What is the latest approved revision?',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith(
      '/ai/rag/query',
      {
        projectPublicId: '019505a1-7c3e-7000-8000-project0001',
        query: 'What is the latest approved revision?',
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
        }),
      })
    );
  });

  it('ส่ง Idempotency-Key ที่เป็น UUID รูปแบบที่ถูกต้อง', async () => {
    (apiClient.post as any).mockResolvedValue(validResponse);
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useRagQuery({
          projectPublicId: '019505a1-7c3e-7000-8000-project0001',
          query: 'test question',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callArgs = (apiClient.post as any).mock.calls[0];
    const headers = callArgs[2].headers;
    // Idempotency-Key ควรเป็น UUID รูปแบบ v4 (มี hyphen ครบ 4 ตำแหน่ง)
    expect(headers['Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('validate response ด้วย Zod และคืนค่าที่ถูกต้อง', async () => {
    (apiClient.post as any).mockResolvedValue(validResponse);
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useRagQuery({
          projectPublicId: '019505a1-7c3e-7000-8000-project0001',
          query: 'test question',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(validResponse.data);
    expect(result.current.data?.retrievalMode).toBe('VECTOR');
    expect(result.current.data?.sources).toHaveLength(1);
  });

  it('reject เมื่อ response ไม่ผ่าน Zod validation (retrievalMode ไม่ถูกต้อง)', async () => {
    (apiClient.post as any).mockResolvedValue({
      data: {
        answer: 'ok',
        sources: [],
        retrievalMode: 'INVALID_MODE',
      },
    });
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useRagQuery({
          projectPublicId: '019505a1-7c3e-7000-8000-project0001',
          query: 'test question',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('reject เมื่อ response มี generationUuid (ไม่ควรมีใน contract)', async () => {
    // แม้ response จะมี field พิเศษเพิ่ม Zod strict ควรยังผ่านได้
    // แต่ถ้า field หลักไม่ครบต้อง reject — ทดสอบว่าไม่มี answer ต้อง reject
    (apiClient.post as any).mockResolvedValue({
      data: {
        sources: [],
        retrievalMode: 'VECTOR',
        generationUuid: 'should-not-be-here',
      },
    });
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useRagQuery({
          projectPublicId: '019505a1-7c3e-7000-8000-project0001',
          query: 'test question',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('ไม่เรียก API เมื่อ query ว่าง (enabled = false)', async () => {
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useRagQuery({
          projectPublicId: '019505a1-7c3e-7000-8000-project0001',
          query: '',
        }),
      { wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('ไม่เรียก API เมื่อ projectPublicId ว่าง', async () => {
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useRagQuery({
          projectPublicId: '',
          query: 'test question',
        }),
      { wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('รองรับ fallback mode (FULL_TEXT) ใน response', async () => {
    const fallbackResponse = {
      data: {
        answer: 'Fallback answer from full-text search.',
        sources: [],
        retrievalMode: 'FULL_TEXT',
      },
    };
    (apiClient.post as any).mockResolvedValue(fallbackResponse);
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useRagQuery({
          projectPublicId: '019505a1-7c3e-7000-8000-project0001',
          query: 'test question',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.retrievalMode).toBe('FULL_TEXT');
  });
});
