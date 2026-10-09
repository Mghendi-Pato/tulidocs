import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  402: 'PAYMENT_REQUIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'FILE_TOO_LARGE',
  422: 'BUSINESS_RULE',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * Converts every error into a consistent JSON body: { statusCode, code, message, details? }.
 * Stack traces and internal messages never leave the server.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    if (res.headersSent) return;
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return { statusCode: status, code: DEFAULT_CODES[status] ?? 'ERROR', message: response };
      }
      const r = response as { code?: string; message?: string | string[]; details?: unknown };
      if (typeof r.message === 'string' && /uuid is expected/i.test(r.message)) {
        return { statusCode: 404, code: 'NOT_FOUND', message: 'Record not found' };
      }
      if (Array.isArray(r.message)) {
        return { statusCode: status, code: 'VALIDATION_ERROR', message: r.message[0] ?? 'Invalid input', details: r.message };
      }
      if (status === 429) {
        return { statusCode: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please wait a moment and try again.' };
      }
      return {
        statusCode: status,
        code: r.code ?? DEFAULT_CODES[status] ?? 'ERROR',
        message: r.message ?? exception.message,
        ...(r.details !== undefined ? { details: r.details } : {}),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          const target = (exception.meta?.target as string[] | string | undefined) ?? 'value';
          const field = Array.isArray(target) ? target.filter((t) => t !== 'organizationId' && t !== 'type').join(', ') : target;
          return { statusCode: HttpStatus.CONFLICT, code: 'DUPLICATE', message: `A record with this ${field || 'value'} already exists` };
        }
        case 'P2025':
          return { statusCode: 404, code: 'NOT_FOUND', message: 'Record not found' };
        case 'P2003':
          return { statusCode: HttpStatus.CONFLICT, code: 'IN_USE', message: 'This record is linked to other records and cannot be removed' };
        default:
          break;
      }
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { statusCode: 400, code: 'BAD_REQUEST', message: 'Invalid data sent to the server' };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' };
  }
}
