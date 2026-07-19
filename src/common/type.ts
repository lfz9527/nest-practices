// 统一响应体结构，成功与错误共用该契约（规格 D1）
export interface ResponseBody<T = null> {
  code: number
  message: string
  data: T
}
