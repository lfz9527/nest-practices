import { ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { Observable } from 'rxjs'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'

export const IS_PUBLIC_KEY = 'isPublic'

// 全局守卫：@Public() 标记的接口放行，其余接口需携带有效 access token
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  // passport 校验失败（无 token/过期/签名错误）时 err 存在；
  // 统一抛 AppError 走业务错误形态（HTTP 200 + body.code 401），与 refresh 的 401 一致
  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err || !user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, '未登录或登录状态过期')
    }
    return user as TUser
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }
    return super.canActivate(context)
  }
}
