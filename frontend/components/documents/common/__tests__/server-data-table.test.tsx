// File: frontend/components/documents/common/__tests__/server-data-table.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerDataTable } from '../server-data-table';
import { ColumnDef } from '@tanstack/react-table';

type TestData = {
  id: string;
  name: string;
};

const columns: ColumnDef<TestData>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
];

const mockData: TestData[] = [
  { id: '1', name: 'Item 1' },
  { id: '2', name: 'Item 2' },
];

describe('ServerDataTable', () => {
  const onPaginationChange = vi.fn();
  const onSortingChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    render(
      <ServerDataTable
        columns={columns}
        data={[]}
        pageCount={1}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        onPaginationChange={onPaginationChange}
        sorting={[]}
        onSortingChange={onSortingChange}
        isLoading={true}
      />
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(
      <ServerDataTable
        columns={columns}
        data={[]}
        pageCount={0}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        onPaginationChange={onPaginationChange}
        sorting={[]}
        onSortingChange={onSortingChange}
        isLoading={false}
      />
    );
    expect(screen.getByText('No results.')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(
      <ServerDataTable
        columns={columns}
        data={mockData}
        pageCount={1}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        onPaginationChange={onPaginationChange}
        sorting={[]}
        onSortingChange={onSortingChange}
        isLoading={false}
      />
    );
    
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('handles pagination controls', async () => {
    const user = userEvent.setup();
    render(
      <ServerDataTable
        columns={columns}
        data={mockData}
        pageCount={3} // Multiple pages
        pagination={{ pageIndex: 1, pageSize: 10 }} // Currently on page 2 (index 1)
        onPaginationChange={onPaginationChange}
        sorting={[]}
        onSortingChange={onSortingChange}
        isLoading={false}
      />
    );

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: /Go to next page/i });
    const prevButton = screen.getByRole('button', { name: /Go to previous page/i });
    const firstButton = screen.getByRole('button', { name: /Go to first page/i });
    const lastButton = screen.getByRole('button', { name: /Go to last page/i });

    expect(nextButton).not.toBeDisabled();
    expect(prevButton).not.toBeDisabled();

    await user.click(nextButton);
    expect(onPaginationChange).toHaveBeenCalled();

    await user.click(prevButton);
    expect(onPaginationChange).toHaveBeenCalledTimes(2);
    
    await user.click(firstButton);
    expect(onPaginationChange).toHaveBeenCalledTimes(3);

    await user.click(lastButton);
    expect(onPaginationChange).toHaveBeenCalledTimes(4);
  });

  it('handles page size change', async () => {
    const user = userEvent.setup();
    render(
      <ServerDataTable
        columns={columns}
        data={mockData}
        pageCount={1}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        onPaginationChange={onPaginationChange}
        sorting={[]}
        onSortingChange={onSortingChange}
        isLoading={false}
      />
    );

    // The SelectTrigger for page size has placeholder or value. We can find it by role 'combobox'
    const selectTrigger = screen.getByRole('combobox');
    await user.click(selectTrigger);
    
    // Select option 20
    const option20 = screen.getByRole('option', { name: '20' });
    await user.click(option20);

    // setPageSize triggers onPaginationChange with the new page size
    expect(onPaginationChange).toHaveBeenCalled();
  });
});
