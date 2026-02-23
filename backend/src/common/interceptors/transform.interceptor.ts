// File: src/common/interceptors/transform.interceptor.ts
// Fix #1: แก้ไข `any` type ให้ถูกต้องตาม nestjs-best-practices (TypeScript Strict Mode)

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Metadata สำหรับ Paginated Response */
export interface ResponseMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Standard API Response Wrapper */
export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  meta?: ResponseMeta;
}

/** Internal shape สำหรับ paginated data ที่ service ส่งมา */
interface PaginatedPayload<T> {
  data: T[];
  meta: ResponseMeta;
  message?: string;
}

function isPaginatedPayload<T>(value: unknown): value is PaginatedPayload<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'meta' in value &&
    Array.isArray((value as PaginatedPayload<T>).data)
  );
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: T) => {
        const response = context.switchToHttp().getResponse<{ statusCode: number }>();

        // Handle Pagination Response (Standardize)
        // ถ้า data มี structure { data: [], meta: {} } ให้ unzip ออกมา
        if (isPaginatedPayload(data)) {
          return {
            statusCode: response.statusCode,
            message: data.message ?? 'Success',
            data: data.data as unknown as T,
            meta: data.meta,
          };
        }

        const dataAsRecord = data as Record<string, unknown>;
        return {
          statusCode: response.statusCode,
          message: (dataAsRecord?.['message'] as string | undefined) ?? 'Success',
          data: (dataAsRecord?.['result'] as T | undefined) ?? data,
        };
      })
    );
  }
}
