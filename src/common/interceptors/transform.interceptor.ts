import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { map, Observable } from 'rxjs'
import { SUCCESS_CODE } from '../constants'

export interface SuccessBody<T> {
  code: number
  message: string
  data: T
}

// 成功响应统一包裹为业务码结构
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  SuccessBody<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessBody<T>> {
    return next
      .handle()
      .pipe(map((data) => ({ code: SUCCESS_CODE, message: 'ok', data })))
  }
}
