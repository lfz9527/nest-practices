import type { ErrorCodeDef } from './type'

// 通用业务常量，与错误/拦截器等实现解耦，各子模块平等引用
export const SUCCESS_CODE = 0

// 业务错误码注册表：新业务错误先在此约定专属码，未约定的用 BIZ_ERROR 兜底
export const ErrorCodes = {
  // 未特殊约定的业务错误兜底
  BIZ_ERROR: { code: -1, httpCode: 400 },
  // 未知异常兜底（非 AppError 的裸错误）
  UNKNOWN: { code: 50000, httpCode: 500 },
  USER_NOT_FOUND: { code: 40401, httpCode: 404 },
} satisfies Record<string, ErrorCodeDef>
