import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { compare } from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { RedisService } from '../redis/redis.service'
import { User } from '../users/user.entity'
import { LoginDto } from './dto/login.dto'

// 会话在 Redis 中的 key 前缀
export const SESSION_KEY_PREFIX = 'auth:session:'

// access token 载荷
export interface AccessTokenPayload {
  sub: number
  email: string
  sessionId: string
  jti: string
  type: 'access'
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async login(loginDto: LoginDto, ip: string) {
    const user = await this.userRepo.findOne({
      where: { email: loginDto.email, delFlag: 0 },
    })
    if (!user) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '账号或密码错误')
    }
    if (user.status === 1) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '账号已被停用')
    }
    const passwordValid = await compare(loginDto.password, user.password)
    if (!passwordValid) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '账号或密码错误')
    }

    const sessionId = randomUUID()
    const jti = randomUUID()
    const accessToken = await this.signAccess(
      user.id,
      user.email,
      sessionId,
      jti,
    )
    await this.redisService.set(
      `${SESSION_KEY_PREFIX}${user.id}:${sessionId}`,
      jti,
      this.accessExpiresIn(),
    )
    await this.userRepo.update(user.id, {
      lastLoginIp: ip,
      lastLoginTime: new Date(),
    })

    const { password: _password, ...userWithoutPassword } = user
    void _password
    return { access_token: accessToken, user: userWithoutPassword }
  }

  async logout(userId: number, sessionId: string): Promise<void> {
    await this.redisService.del(`${SESSION_KEY_PREFIX}${userId}:${sessionId}`)
  }

  private signAccess(
    sub: number,
    email: string,
    sessionId: string,
    jti: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub, email, sessionId, jti, type: 'access' } satisfies AccessTokenPayload,
      { expiresIn: this.configService.get<number>('jwt.accessExpiresIn') },
    )
  }

  private accessExpiresIn(): number {
    return this.configService.get<number>('jwt.accessExpiresIn')!
  }
}
