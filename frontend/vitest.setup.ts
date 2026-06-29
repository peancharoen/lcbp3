import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock @hookform/resolvers/zod to handle Zod v4 prototype mismatch gracefully
vi.mock('@hookform/resolvers/zod', async (importOriginal) => {
  const original = await importOriginal<typeof import('@hookform/resolvers/zod')>();
  return {
    ...original,
    zodResolver: (schema: any, schemaOptions: any, resolverOptions: any) => {
      const resolver = original.zodResolver(schema, schemaOptions, resolverOptions);
      return async (values: any, context: any, options: any) => {
        try {
          return await resolver(values, context, options);
        } catch (error: any) {
          if (error.issues) {
            const errors = error.issues.reduce((acc: any, issue: any) => {
              const path = issue.path.join('.');
              acc[path] = {
                type: issue.code,
                message: issue.message,
              };
              return acc;
            }, {});
            return { values: {}, errors };
          }
          throw error;
        }
      };
    },
  };
});

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
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
  useParams: () => ({}),
}));

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

class IntersectionObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

// Mock scrollIntoView for cmdk component
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
