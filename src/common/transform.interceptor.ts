import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { map, Observable } from 'rxjs'
import { SUCCESS_CODE } from './app-error'

export interface SuccessBody<T> {
  code: number
  message: string
  data: T
}

// 成功响应统一包裹为业务码结构（规格 D1）；'ok' 为已批准契约中的固定成功文案
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, SuccessBody<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessBody<T>> {
    return next
      .handle()
      .pipe(map((data) => ({ code: SUCCESS_CODE, message: 'ok', data })))
  }
}
