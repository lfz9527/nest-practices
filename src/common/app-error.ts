// 业务响应码统一管理：成功码与错误码都集中在本文件（规格 D8）
export const SUCCESS_CODE = 0

export interface ErrorCodeDef {
  code: number
  httpCode: number
}

// 业务错误码注册表：新业务错误先在此约定专属码，未约定的用 BIZ_ERROR 兜底
export const ErrorCodes = {
  // 未特殊约定的业务错误兜底
  BIZ_ERROR: { code: -1, httpCode: 400 },
  // 未知异常兜底（非 AppError 的裸错误）
  UNKNOWN: { code: 50000, httpCode: 500 },
  USER_NOT_FOUND: { code: 40401, httpCode: 404 },
} satisfies Record<string, ErrorCodeDef>

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
