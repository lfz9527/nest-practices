import { ErrorCodes } from '../constants'

// 唯一错误模型：不为每种错误建子类，用 code 属性区分
export class AppError extends Error {
  readonly code: number
  readonly isOperational: boolean

  constructor(code: number, message: string, isOperational?: boolean)
  constructor(message: string, isOperational?: boolean)
  constructor(
    codeOrMessage: number | string,
    messageOrIsOperational?: string | boolean,
    isOperational = true,
  ) {
    // 省略错误码的构造形态取 BIZ_ERROR 兜底（规格 D8）
    const withCode = typeof codeOrMessage !== 'string'
    const code = withCode ? codeOrMessage : ErrorCodes.BIZ_ERROR
    super(withCode ? (messageOrIsOperational as string) : codeOrMessage)
    this.name = 'AppError'
    this.code = code
    this.isOperational = withCode
      ? isOperational
      : ((messageOrIsOperational as boolean | undefined) ?? true)
    // 保留栈追踪，起点指向抛错处
    Error.captureStackTrace(this, this.constructor)
  }
}
