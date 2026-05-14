// File: frontend/components/response-code/ResponseCodeSelector.test.tsx
// Unit tests สำหรับ ResponseCodeSelector component (T078)
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ResponseCodeSelector } from '@/components/response-code/ResponseCodeSelector';

vi.mock('@/hooks/use-response-codes', () => ({
  useResponseCodesByDocType: vi.fn(() => ({
    data: [
      {
        publicId: 'uuid-1',
        code: '1A',
        category: 'ENGINEERING',
        descriptionEn: 'Approved — No Comments',
        descriptionTh: 'ผ่าน — ไม่มีเงื่อนไข',
        implications: {},
        notifyRoles: [],
        isActive: true,
        isSystem: true,
      },
      {
        publicId: 'uuid-2',
        code: '2',
        category: 'ENGINEERING',
        descriptionEn: 'Approved with Comments',
        descriptionTh: 'ผ่าน — มีเงื่อนไข',
        implications: { affectsSchedule: true },
        notifyRoles: ['CONTRACT_MANAGER'],
        isActive: true,
        isSystem: true,
      },
    ],
    isLoading: false,
  })),
}));

describe('ResponseCodeSelector', () => {
  it('renders the trigger with placeholder text', () => {
    render(
      <ResponseCodeSelector
        documentTypeId={1}
        value={undefined}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByText('Select Response Code...')).toBeTruthy();
  });

  it('renders a custom placeholder when provided', () => {
    render(
      <ResponseCodeSelector
        documentTypeId={1}
        value={undefined}
        onChange={vi.fn()}
        placeholder="Choose a response code"
      />,
    );

    expect(screen.getByText('Choose a response code')).toBeTruthy();
  });
});
