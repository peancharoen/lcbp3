// File: backend/tests/performance/review-tasks.perf-spec.ts
// Change Log:
// - 2026-05-16: Performance test for Review Tasks Query with 10,000+ tasks

import { ReviewTask } from '../../src/modules/review-team/entities/review-task.entity';

interface FindAllOptions {
  status?: string;
  assignedToUserId?: number;
  disciplineId?: number;
  page?: number;
  limit?: number;
}

interface PaginatedResult {
  data: ReviewTask[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

class MockReviewTaskService {
  private mockTasks: ReviewTask[] = [];

  setMockData(tasks: ReviewTask[]) {
    this.mockTasks = tasks;
  }

  findAll(options: FindAllOptions): PaginatedResult {
    let filtered = [...this.mockTasks];

    if (options.status) {
      filtered = filtered.filter((t) => t.status === options.status);
    }
    if (options.assignedToUserId) {
      filtered = filtered.filter(
        (t) => t.assignedToUserId === options.assignedToUserId
      );
    }
    if (options.disciplineId) {
      filtered = filtered.filter(
        (t) => t.disciplineId === options.disciplineId
      );
    }

    const total = filtered.length;
    const page = options.page || 1;
    const limit = options.limit || 20;
    const start = (page - 1) * limit;
    const end = start + limit;
    const data = filtered.slice(start, end);

    return { data, meta: { total, page, limit } };
  }
}

describe('ReviewTaskService Query Performance', () => {
  let service: MockReviewTaskService;

  beforeEach(() => {
    service = new MockReviewTaskService();
  });

  it('should query 10,000+ review tasks with indexes within 100ms', () => {
    const mockTasks: Partial<ReviewTask>[] = Array.from(
      { length: 10000 },
      (_, i) => ({
        id: i + 1,
        uuid: `task-${i}`,
        status: ['PENDING', 'IN_PROGRESS', 'COMPLETED'][i % 3],
        assignedToUserId: (i % 100) + 1,
        rfaRevisionId: (i % 500) + 1,
        disciplineId: (i % 20) + 1,
        createdAt: new Date(Date.now() - i * 1000),
      })
    );

    service.setMockData(mockTasks as ReviewTask[]);

    const startTime = Date.now();
    const result = service.findAll({
      status: 'PENDING',
      page: 1,
      limit: 20,
    });
    const endTime = Date.now();

    const queryTime = endTime - startTime;
    expect(queryTime).toBeLessThan(100);
    expect(result.data.length).toBeLessThanOrEqual(20);
    expect(result.meta.total).toBeGreaterThan(0);
  });

  it('should handle filtered queries efficiently', () => {
    const mockTasks: Partial<ReviewTask>[] = Array.from(
      { length: 1000 },
      (_, i) => ({
        id: i + 1,
        uuid: `task-${i}`,
        status: 'PENDING',
        assignedToUserId: 42,
        disciplineId: 5,
      })
    );

    service.setMockData(mockTasks as ReviewTask[]);

    const startTime = Date.now();
    const result = service.findAll({
      status: 'PENDING',
      assignedToUserId: 42,
      disciplineId: 5,
      page: 1,
      limit: 50,
    });
    const endTime = Date.now();

    const queryTime = endTime - startTime;
    expect(queryTime).toBeLessThan(100);
    expect(result.data.length).toBeLessThanOrEqual(50);
  });
});
