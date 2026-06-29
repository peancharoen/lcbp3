'use client';

// ADR-021 T042: Error Boundary สำหรับ WorkflowLifecycle และ FilePreviewModal
// ป้องกัน crash ทั้งหน้าเมื่อเกิด unexpected error ใน Workflow components
// ต้องใช้ class component เพราะ React Error Boundary ยังไม่รองรับ hooks

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Custom fallback — ถ้าไม่ระบุจะแสดง default message */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class WorkflowErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-md bg-muted/50 p-4 text-center text-sm text-muted-foreground">
            เกิดข้อผิดพลาด ไม่สามารถแสดง Workflow ได้ กรุณารีเฟรชหน้า
          </div>
        )
      );
    }
    return this.props.children;
  }
}
