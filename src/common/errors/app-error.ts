import type { ErrorCodeDef } from '../type'
import { ErrorCodes } from '../constants'

// 唯一错误模型：不为每种错误建子类，用 code 属性区分
export class AppError extends Error {
  readonly code: number
  readonly httpCode: number
  readonly isOperational: boolean

  constructor(def: ErrorCodeDef, message: string, isOperational?: boolean)
  constructor(message: string, isOperational?: boolean)
  constructor(
    defOrMessage: ErrorCodeDef | string,
    messageOrIsOperational?: string | boolean,
    isOperational = true,
  ) {
    // 省略错误码定义的构造形态取 BIZ_ERROR 兜底（规格 D8）
    const withDef = typeof defOrMessage !== 'string'
    const def = withDef ? defOrMessage : ErrorCodes.BIZ_ERROR
    super(withDef ? (messageOrIsOperational as string) : defOrMessage)
    this.name = 'AppError'
    this.code = def.code
    this.httpCode = def.httpCode
    this.isOperational = withDef
      ? isOperational
      : ((messageOrIsOperational as boolean | undefined) ?? true)
    // 保留栈追踪，起点指向抛错处
    Error.captureStackTrace(this, this.constructor)
  }
}
