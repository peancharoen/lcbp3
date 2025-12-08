import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  statusCode: number;
  message: string;
  data: T;
  meta?: any;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data: any) => {
        const response = context.switchToHttp().getResponse();

        // Handle Pagination Response (Standardize)
        // ถ้า data มี structure { data: [], meta: {} } ให้ unzip ออกมา
        if (data && data.data && data.meta) {
          return {
            statusCode: response.statusCode,
            message: data.message || 'Success',
            data: data.data,
            meta: data.meta,
          };
        }

        return {
          statusCode: response.statusCode,
          message: data?.message || 'Success',
          data: data?.result || data,
        };
      })
    );
  }
}
