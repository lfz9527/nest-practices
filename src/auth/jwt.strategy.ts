import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { AccessTokenPayload } from './auth.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
      // 显式固定签名算法，防止算法混淆攻击（jwt algorithm confusion）
      algorithms: ['HS256'],
    })
  }

  // access token 无状态验证：仅验签名、有效期与类型，不查数据库
  validate(payload: AccessTokenPayload): AccessTokenPayload {
    if (payload.type !== 'access') {
      throw new AppError(ErrorCodes.UNAUTHORIZED, '令牌类型无效，请重新登录')
    }
    return payload
  }
}
