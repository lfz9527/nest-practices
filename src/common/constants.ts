// 通用业务常量，与错误/拦截器等实现解耦，各子模块平等引用
export const SUCCESS_CODE = 0

// 业务统一返回 200
export const BIZ_HTTP_CODE = 200

// 未知错误，属于服务端错误
export const UNKNOWN_HTTP_CODE = 500

// 业务错误码
export const ErrorCodes = {
  BIZ_ERROR: -1,
} as const
