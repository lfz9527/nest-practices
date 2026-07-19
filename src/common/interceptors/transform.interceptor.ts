import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { map, Observable } from 'rxjs'
import { SUCCESS_CODE } from '../constants'
import { ResponseBody } from '../type'

// 成功响应统一包裹为业务码结构
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ResponseBody<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ResponseBody<T>> {
    return next
      .handle()
      .pipe(map((data) => ({ code: SUCCESS_CODE, message: 'ok', data })))
  }
}
