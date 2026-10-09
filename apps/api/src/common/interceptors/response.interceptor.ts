import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Paginated } from '../dto/pagination.dto';

/**
 * Wraps every successful JSON response:
 *   single → { data }
 *   list   → { data: [...], meta: { total, page, pageSize, pageCount } }
 * Files (StreamableFile) pass through untouched.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown) => {
        if (result instanceof StreamableFile) return result;
        if (result instanceof Paginated) return { data: result.items, meta: result.meta };
        return { data: result ?? null };
      }),
    );
  }
}
