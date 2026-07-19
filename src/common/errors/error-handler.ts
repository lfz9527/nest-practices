import { HttpException, Injectable } from '@nestjs/common'
import type { Response } from 'express'
import { PinoLogger } from 'nestjs-pino'
import { AppError } from './app-error'
import { BIZ_HTTP_CODE, UNKNOWN_HTTP_CODE } from '../constants'
import { ResponseBody } from '../type'

// 集中错误处理器：所有入口的错误最终都汇到这里
@Injectable()
export class ErrorHandler {
  // 优雅退出动作由 main.ts 在挂进程钩子前注入（规格 §3 顺序保证）
  private shutdown?: () => Promise<void>

  constructor(private readonly logger: PinoLogger) {}

  registerShutdown(fn: () => Promise<void>): void {
    this.shutdown = fn
  }

  handleError(error: unknown, response?: Response): void {
    const { httpCode, body, logLevel } = this.normalize(error)
    this.logger[logLevel]({ err: error }, body.message)
    if (response) {
      // HTTP 路径：发响应后进程继续
      response.status(httpCode).json(body)
      return
    }
    // 进程级游离错误：不可信即优雅退出
    if (!this.isTrustedError(error)) {
      if (this.shutdown) {
        void this.shutdown()
      }
    }
  }

  // 可信度判定口径：非 AppError 一律不可信
  isTrustedError(error: unknown): boolean {
    return error instanceof AppError && error.isOperational
  }

  private normalize(error: unknown): {
    httpCode: number
    body: ResponseBody
    logLevel: 'warn' | 'error' | 'fatal'
  } {
    if (error instanceof AppError) {
      // 业务错误统一 HTTP 200，由 body.code 区分具体错误
      return {
        httpCode: BIZ_HTTP_CODE,
        body: { code: error.code, message: error.message, data: null },
        logLevel: 'error',
      }
    }
    if (error instanceof HttpException) {
      // 系统错误（框架自发异常）
      const status = error.getStatus()
      return {
        httpCode: status,
        body: {
          code: status,
          message: this.extractMessage(error),
          data: null,
        },
        logLevel: 'error',
      }
    }
    // 未知异常兜底：对外不泄露内部细节，统一固定文案（规格 §5）
    return {
      httpCode: UNKNOWN_HTTP_CODE,
      body: {
        code: UNKNOWN_HTTP_CODE,
        message: '服务器内部错误',
        data: null,
      },
      logLevel: 'fatal',
    }
  }

  private extractMessage(exception: HttpException): string {
    const res = exception.getResponse()
    if (typeof res === 'string') {
      return res
    }
    const message = (res as { message?: string | string[] }).message
    // 校验类异常的 message 为数组
    if (Array.isArray(message)) {
      return message.join('; ')
    }
    // getResponse 对象缺 message 字段时兜底取异常自身 message
    return message ?? exception.message
  }
}
