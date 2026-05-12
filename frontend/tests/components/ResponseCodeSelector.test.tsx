// File: frontend/tests/components/ResponseCodeSelector.test.tsx
// Unit tests สำหรับ ResponseCodeSelector component (T078)
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResponseCodeSelector } from '@/components/response-code/ResponseCodeSelector';

const mockCodes = [
  {
    publicId: 'uuid-1',
    code: '1A',
    category: 'ENGINEERING',
    descriptionEn: 'Approved — No Comments',
    descriptionTh: 'ผ่าน — ไม่มีเงื่อนไข',
    implications: {},
    notifyRoles: [],
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
    isSystem: true,
  },
  {
    publicId: 'uuid-3',
    code: '3',
    category: 'ENGINEERING',
    descriptionEn: 'Rejected',
    descriptionTh: 'ไม่ผ่าน',
    implications: {},
    notifyRoles: [],
    isSystem: true,
  },
];

describe('ResponseCodeSelector', () => {
  it('should render code options', () => {
    const onSelect = jest.fn();
    render(<ResponseCodeSelector codes={mockCodes} onSelect={onSelect} />);

    expect(screen.getByText('1A')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should call onSelect when a code is clicked', () => {
    const onSelect = jest.fn();
    render(<ResponseCodeSelector codes={mockCodes} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('1A'));
    expect(onSelect).toHaveBeenCalledWith('uuid-1');
  });

  it('should highlight selected code', () => {
    const onSelect = jest.fn();
    render(
      <ResponseCodeSelector
        codes={mockCodes}
        onSelect={onSelect}
        selectedPublicId="uuid-2"
      />,
    );

    const selectedButton = screen.getByRole('button', { name: /2/i });
    expect(selectedButton).toHaveClass('ring-2');
  });
});
