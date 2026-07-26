import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ErrorHandler } from './error-handler'

// 此类无关请求不做错误日志记录，直接静默返回 404
const silentPaths = ['/.well-known/appspecific/com.chrome.devtools.json']

// 只做捕获转发，处理逻辑全部集中于 ErrorHandler
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

    this.errorHandler.handleError(exception, ctx.getResponse<Response>())
  }
}
