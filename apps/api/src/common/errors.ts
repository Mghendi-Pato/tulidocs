import { HttpException, HttpStatus } from '@nestjs/common';

/** A violated business rule (invalid status change, overpayment, …). HTTP 422. */
export class BusinessRuleException extends HttpException {
  constructor(message: string, code = 'BUSINESS_RULE', details?: Record<string, unknown>) {
    super({ code, message, details }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class NotFound extends HttpException {
  constructor(entity: string) {
    super({ code: 'NOT_FOUND', message: `${entity} not found` }, HttpStatus.NOT_FOUND);
  }
}

/** The plan doesn't allow this (limit reached, feature not included). HTTP 402. */
export class PlanLimitException extends HttpException {
  constructor(message: string, code = 'PLAN_LIMIT') {
    super({ code, message }, HttpStatus.PAYMENT_REQUIRED);
  }
}
