// File: frontend/components/common/__tests__/workflow-error-boundary.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for WorkflowErrorBoundary component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkflowErrorBoundary } from '../workflow-error-boundary';

const ProblematicComponent = () => {
  throw new Error('Test crash error');
};

describe('WorkflowErrorBoundary Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('ควรเรนเดอร์ children ตามปกติเมื่อไม่มีข้อผิดพลาด', () => {
    render(
      <WorkflowErrorBoundary>
        <div>Safe Content</div>
      </WorkflowErrorBoundary>
    );
    expect(screen.getByText('Safe Content')).toBeInTheDocument();
  });

  it('ควรเรนเดอร์ default message เมื่อตรวจพบข้อผิดพลาดใน Component ย่อย', () => {
    render(
      <WorkflowErrorBoundary>
        <ProblematicComponent />
      </WorkflowErrorBoundary>
    );
    expect(screen.getByText('เกิดข้อผิดพลาด ไม่สามารถแสดง Workflow ได้ กรุณารีเฟรชหน้า')).toBeInTheDocument();
  });

  it('ควรเรนเดอร์ custom fallback เมื่อตรวจพบข้อผิดพลาดและส่ง fallback มาให้', () => {
    render(
      <WorkflowErrorBoundary fallback={<div>Custom Error Alert</div>}>
        <ProblematicComponent />
      </WorkflowErrorBoundary>
    );
    expect(screen.getByText('Custom Error Alert')).toBeInTheDocument();
  });
});
