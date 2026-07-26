import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { map, Observable } from 'rxjs'
import { ResponseBody } from '../types'

// 成功响应业务码
const SUCCESS_CODE = 0

// 成功响应统一包裹为业务码结构
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ResponseBody<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ResponseBody<T>> {
    return next
      .handle()
      .pipe(map((data) => ({ code: SUCCESS_CODE, message: 'ok', data })))
  }
}
