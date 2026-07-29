import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { InjectRepository } from '@nestjs/typeorm'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { User } from '../users/user.entity'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    })
  }

  async validate(payload: { sub: number; ver: number }): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub, delFlag: 0 },
    })
    if (!user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, '用户不存在或已被删除')
    }
    if (payload.ver !== user.tokenVersion) {
      throw new AppError(
        ErrorCodes.UNAUTHORIZED,
        '当前登录状态已失效，请重新登录',
      )
    }
    return user
  }
}
