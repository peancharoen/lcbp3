// File: frontend/components/numbering/__tests__/audit-logs-table.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLogsTable } from '../audit-logs-table';
import { documentNumberingService } from '@/lib/services/document-numbering.service';

vi.mock('@/lib/services/document-numbering.service', () => ({
  documentNumberingService: {
    getMetrics: vi.fn(),
  },
}));

describe('AuditLogsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(documentNumberingService.getMetrics).mockImplementation(() => new Promise(() => {}));
    render(<AuditLogsTable />);
    expect(screen.getByText('Loading logs...')).toBeInTheDocument();
  });

  it('renders empty state when no logs returned', async () => {
    vi.mocked(documentNumberingService.getMetrics).mockResolvedValue({ audit: [] } as any);
    render(<AuditLogsTable />);
    
    await waitFor(() => {
      expect(screen.getByText('No logs found.')).toBeInTheDocument();
    });
  });

  it('renders error state silently as empty state when API fails', async () => {
    vi.mocked(documentNumberingService.getMetrics).mockRejectedValue(new Error('API failed'));
    render(<AuditLogsTable />);
    
    await waitFor(() => {
      expect(screen.getByText('No logs found.')).toBeInTheDocument();
    });
  });

  it('renders logs correctly', async () => {
    const mockLogs = [
      {
        id: 1,
        createdAt: '2023-10-27T10:00:00Z',
        operation: 'GENERATE',
        documentNumber: 'DOC-001',
        createdBy: 'UserA',
        status: 'SUCCESS',
      },
      {
        id: 2,
        createdAt: '2023-10-27T11:00:00Z',
        operation: 'VOID',
        documentNumber: 'DOC-002',
        createdBy: null,
        status: 'FAILED',
      },
    ];
    vi.mocked(documentNumberingService.getMetrics).mockResolvedValue({ audit: mockLogs } as any);
    
    render(<AuditLogsTable />);
    
    await waitFor(() => {
      expect(screen.getByText('DOC-001')).toBeInTheDocument();
    });

    expect(screen.getByText('GENERATE')).toBeInTheDocument();
    expect(screen.getByText('UserA')).toBeInTheDocument();
    expect(screen.getByText('SUCCESS')).toBeInTheDocument();

    expect(screen.getByText('DOC-002')).toBeInTheDocument();
    expect(screen.getByText('VOID')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument(); // Falls back to System
    expect(screen.getByText('FAILED')).toBeInTheDocument();
  });
});
