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

// refresh token 在 Redis 中的 key 前缀（单端登录：同 userId 只存最新 jti）
export const REFRESH_KEY_PREFIX = 'auth:refresh:'

// access token 载荷
export interface AccessTokenPayload {
  sub: number
  email: string
  type: 'access'
}

// refresh token 载荷
interface RefreshTokenPayload {
  sub: number
  jti: string
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

    const refreshJti = randomUUID()
    const accessToken = await this.signAccess(user.id, user.email)
    const refreshToken = await this.signRefresh(user.id, refreshJti)
    // 覆盖写入即实现单端登录：旧会话 refresh 立即失效
    await this.redisService.set(
      `${REFRESH_KEY_PREFIX}${user.id}`,
      refreshJti,
      this.refreshExpiresIn(),
    )
    await this.userRepo.update(user.id, {
      lastLoginIp: ip,
      lastLoginTime: new Date(),
    })

    const { password: _password, ...userWithoutPassword } = user
    void _password
    return { access_token: accessToken, refresh_token: refreshToken, user: userWithoutPassword }
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken)
    } catch {
      throw new AppError(ErrorCodes.UNAUTHORIZED, '登录状态已失效，请重新登录')
    }

    const storedJti = await this.redisService.get(
      `${REFRESH_KEY_PREFIX}${payload.sub}`,
    )
    if (storedJti !== payload.jti) {
      // 已被顶号、已登出或旧 token 重放
      throw new AppError(ErrorCodes.UNAUTHORIZED, '登录状态已失效，请重新登录')
    }

    // 轮换：删旧 jti，签发新 refresh
    const newJti = randomUUID()
    await this.redisService.del(`${REFRESH_KEY_PREFIX}${payload.sub}`)
    const accessToken = await this.signAccess(payload.sub, '')
    const newRefreshToken = await this.signRefresh(payload.sub, newJti)
    await this.redisService.set(
      `${REFRESH_KEY_PREFIX}${payload.sub}`,
      newJti,
      this.refreshExpiresIn(),
    )

    return { access_token: accessToken, refresh_token: newRefreshToken }
  }

  async logout(userId: number): Promise<void> {
    await this.redisService.del(`${REFRESH_KEY_PREFIX}${userId}`)
  }

  private signAccess(sub: number, email: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub, email, type: 'access' } satisfies AccessTokenPayload,
      { expiresIn: this.configService.get<number>('jwt.accessExpiresIn') },
    )
  }

  private signRefresh(sub: number, jti: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub, jti } satisfies RefreshTokenPayload,
      { expiresIn: this.configService.get<number>('jwt.refreshExpiresIn') },
    )
  }

  private refreshExpiresIn(): number {
    return this.configService.get<number>('jwt.refreshExpiresIn')!
  }
}
