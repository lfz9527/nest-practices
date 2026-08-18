import type { Server } from 'node:http'

import {
  Controller,
  Get,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { hash } from 'bcryptjs'
import { PinoLogger } from 'nestjs-pino'
import request from 'supertest'
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter'
import { ErrorHandler } from '../common/errors/error-handler'
import { TransformInterceptor } from '../common/interceptors/transform.interceptor'
import { RedisService } from '../redis/redis.service'
import { User } from '../users/user.entity'
import { UsersController } from '../users/users.controller'
import { UsersService } from '../users/users.service'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './auth.guard'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'

@Controller('home')
class HomeController {
  @Get()
  home(): string {
    return 'home'
  }
}

describe('认证 E2E', () => {
  let app: INestApplication
  let httpServer: Server
  const userRepo = { findOne: jest.fn(), update: jest.fn() }
  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
  let hashedPassword: string

  // mock 调用记录按用例清空，避免跨用例累计干扰 jti 捕获
  beforeEach(() => {
    userRepo.findOne.mockClear()
    userRepo.update.mockClear()
    redisMock.get.mockClear()
    redisMock.set.mockClear()
    redisMock.del.mockClear()
  })

  beforeAll(async () => {
    hashedPassword = await hash('123456', 10)
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: 'test-secret' }),
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              jwt: { secret: 'test-secret', accessExpiresIn: 604800 },
            }),
          ],
        }),
      ],
      controllers: [AuthController, UsersController, HomeController],
      providers: [
        AuthService,
        UsersService,
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: RedisService, useValue: redisMock },
        {
          provide: PinoLogger,
          useValue: { error: jest.fn(), fatal: jest.fn(), warn: jest.fn() },
        },
        ErrorHandler,
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
    await app.init()
    httpServer = app.getHttpServer() as Server
  })

  afterAll(async () => {
    await app.close()
  })

  const mockUser = () => ({
    id: 1,
    nickname: '甄嬛',
    email: 'admin@example.com',
    password: hashedPassword,
    status: 0,
    delFlag: 0,
    lastLoginIp: '',
    lastLoginTime: null,
  })

  // 登录并返回 access token（同时让 mock 就绪：redis.get 返回本次登录写入的 jti）
  const loginAndGetToken = async () => {
    userRepo.findOne.mockResolvedValue(mockUser())
    userRepo.update.mockResolvedValue({ affected: 1 })
    redisMock.set.mockResolvedValue(undefined)
    const res = await request(httpServer).post('/auth/login').send({
      email: 'admin@example.com',
      password: '123456',
    })
    // 同一用例内可能多次登录，取最后一次 set 调用对应的 jti
    const jti = (
      redisMock.set.mock.calls[redisMock.set.mock.calls.length - 1] as [
        string,
        string,
      ]
    )[1]
    redisMock.get.mockResolvedValue(jti)
    return (res.body as { data: { access_token: string } }).data.access_token
  }

  it('登录：返回 access_token 与 user（不含 password），会话 jti 写入 Redis', async () => {
    userRepo.findOne.mockResolvedValue(mockUser())
    userRepo.update.mockResolvedValue({ affected: 1 })
    redisMock.set.mockResolvedValue(undefined)

    const res = await request(httpServer).post('/auth/login').send({
      email: 'admin@example.com',
      password: '123456',
    })
    expect(res.status).toBe(200)
    const body = res.body as {
      code: number
      data: { access_token: string; user: { id: number } }
    }
    expect(body.code).toBe(0)
    expect(body.data.access_token).toEqual(expect.any(String))
    expect(body.data.user).not.toHaveProperty('password')
    expect(redisMock.set).toHaveBeenCalledWith(
      expect.stringContaining('auth:session:1'),
      expect.any(String),
      604800,
    )
    // 不签发 refresh token
    expect(body.data).not.toHaveProperty('refresh_token')
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('未登录访问受保护接口：业务错误形态 401', async () => {
    const res = await request(httpServer).get('/home')
    // 守卫抛 AppError → 业务错误形态：HTTP 200 + body.code 401
    expect(res.status).toBe(200)
    expect((res.body as { code: number }).code).toBe(401)
  })

  it('携带 access token 访问受保护接口：成功', async () => {
    const accessToken = await loginAndGetToken()

    const res = await request(httpServer)
      .get('/home')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    expect((res.body as { code: number }).code).toBe(0)
  })

  it('登出后：旧 access token 失效（Redis 会话已删）', async () => {
    const accessToken = await loginAndGetToken()

    const logoutRes = await request(httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(logoutRes.status).toBe(200)

    // 登出后 Redis 无会话 jti，守卫比对失败 → 401
    redisMock.get.mockResolvedValue(null)
    const res = await request(httpServer)
      .get('/home')
      .set('Authorization', `Bearer ${accessToken}`)
    expect((res.body as { code: number }).code).toBe(401)
  })

  it('单端顶号：重新登录后旧 token 失效', async () => {
    const oldToken = await loginAndGetToken()
    // 同账号再次登录：Redis 会话 jti 被覆盖为新值
    const newToken = await loginAndGetToken()
    expect(newToken).not.toBe(oldToken)

    // 旧 token 访问：Redis 中的 jti 已是新值 → 401
    const res = await request(httpServer)
      .get('/home')
      .set('Authorization', `Bearer ${oldToken}`)
    expect((res.body as { code: number }).code).toBe(401)

    // 新 token 正常
    const ok = await request(httpServer)
      .get('/home')
      .set('Authorization', `Bearer ${newToken}`)
    expect((ok.body as { code: number }).code).toBe(0)
  })
})
