import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { ErrorHandler } from './error-handler'

// 只做捕获转发，处理逻辑全部集中于 ErrorHandler
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly errorHandler: ErrorHandler) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    this.errorHandler.handleError(
      exception,
      host.switchToHttp().getResponse<Response>(),
    )
  }
}
