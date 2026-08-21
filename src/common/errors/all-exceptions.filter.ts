import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { AppError } from './app-error'
import { ErrorCodes } from './error-codes'
import { ErrorHandler } from './error-handler'

// 此类无关请求不做错误日志记录，直接静默返回 404
const silentPaths = ['/.well-known/appspecific/com.chrome.devtools.json']

// 错误分类与错误码归一化统一在这里完成，ErrorHandler 只负责渲染
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly errorHandler: ErrorHandler) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()

    if (silentPaths.some((path) => request.url.startsWith(path))) {
      ctx.getResponse<Response>().status(404).end()
      return
    }

    // 校验类异常（400，ValidationPipe/ParseIntPipe 抛出）统一转为业务错误形态：HTTP 200 + code -1
    this.errorHandler.handleError(
      this.normalize(exception),
      ctx.getResponse<Response>(),
    )
  }

  private normalize(exception: unknown): unknown {
    if (
      !(exception instanceof HttpException) ||
      exception.getStatus() !== 400
    ) {
      return exception
    }
    return new AppError(
      ErrorCodes.BIZ_ERROR,
      this.errorHandler.extractMessage(exception),
    )
  }
}
