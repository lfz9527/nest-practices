// 正常返回，业务码为 0
export const SUCCESS_CODE = 0

// 业务httpCode统一返回 200
export const BIZ_HTTP_CODE = 200

// 未知错误，属于服务端错误
export const UNKNOWN_HTTP_CODE = 500

// 业务错误码
export const ErrorCodes = {
  // 默认错误码
  BIZ_ERROR: -1,
} as const
