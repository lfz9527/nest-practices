import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { RedisService } from '../redis/redis.service'
import { AccessTokenPayload, SESSION_KEY_PREFIX } from './auth.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
      // 显式固定签名算法，防止算法混淆攻击（jwt algorithm confusion）
      algorithms: ['HS256'],
    })
  }

  // 验签名 + 会话比对：Redis 中的 jti 必须与 token 一致（顶号/登出后即失效）
  async validate(payload: AccessTokenPayload): Promise<AccessTokenPayload> {
    if (payload.type !== 'access') {
      throw new AppError(ErrorCodes.UNAUTHORIZED, '令牌类型无效，请重新登录')
    }
    const storedJti = await this.redisService.get(
      `${SESSION_KEY_PREFIX}${payload.sub}:${payload.sessionId}`,
    )
    if (storedJti !== payload.jti) {
      // 已被顶号或已登出
      throw new AppError(ErrorCodes.UNAUTHORIZED, '未登录或登录状态过期')
    }
    return payload
  }
}
