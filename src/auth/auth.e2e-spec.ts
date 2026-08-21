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
import { CaptchaService } from './captcha.service'
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
  const sessionJtis = new Map<string, string>()
  let hashedPassword: string

  // mock 调用记录按用例清空，避免跨用例累计干扰 jti 捕获
  beforeEach(() => {
    userRepo.findOne.mockClear()
    userRepo.update.mockClear()
    redisMock.get.mockClear()
    redisMock.set.mockClear()
    redisMock.del.mockClear()
    sessionJtis.clear()
    redisMock.get.mockImplementation(
      (key: string) => sessionJtis.get(key) ?? null,
    )
    redisMock.set.mockImplementation((key: string, value: string) => {
      sessionJtis.set(key, value)
    })

    redisMock.del.mockImplementation((key: string) => {
      sessionJtis.delete(key)
    })
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
              captcha: { expiresIn: 300 },
            }),
          ],
        }),
      ],
      controllers: [AuthController, UsersController, HomeController],
      providers: [
        AuthService,
        { provide: CaptchaService, useValue: { verify: jest.fn() } },
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

  // 登录并返回 access token 及其 Redis 会话信息
  const loginAndGetSession = async () => {
    userRepo.findOne.mockResolvedValue(mockUser())
    userRepo.update.mockResolvedValue({ affected: 1 })
    const captcha = 'captcha-id'
    const captchaCode = '1234'
    const res = await request(httpServer).post('/auth/login').send({
      email: 'admin@example.com',
      password: '123456',
      captchaId: captcha,
      captchaCode,
    })
    const [key, jti] = redisMock.set.mock.calls[
      redisMock.set.mock.calls.length - 1
    ] as [string, string]
    return {
      response: res,
      token: (res.body as { data: { access_token: string } }).data.access_token,
      key,
      jti,
    }
  }

  const loginAndGetToken = async () => {
    const session = await loginAndGetSession()
    return session.token
  }

  it('登录：返回 access_token 与 user（不含 password），会话 jti 写入 Redis', async () => {
    const session = await loginAndGetSession()
    const res = session.response
    expect(session.key).toMatch(/^auth:session:1:[^:]+$/)
    expect(session.jti).toEqual(expect.any(String))

    expect(res.status).toBe(200)
    const body = res.body as {
      code: number
      data: { access_token: string; user: { id: number } }
    }
    expect(body.code).toBe(0)
    expect(body.data.access_token).toEqual(expect.any(String))
    expect(body.data.user).not.toHaveProperty('password')
    expect(redisMock.set).toHaveBeenLastCalledWith(
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

  it('登录参数不合法：校验异常按业务错误形态返回（HTTP 200 + code -1）', async () => {
    const res = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'not-an-email' })
    expect(res.status).toBe(200)
    const body = res.body as { code: number; message: string; data: unknown }
    expect(body.code).toBe(-1)
    expect(body.data).toBeNull()
    // ValidationPipe 校验消息：缺失的必填字段错误以 ; 拼接（email 仅校验必填，非空即通过）
    expect(body.message).toContain('验证码标识不能为空')
    expect(body.message).toContain('验证码不能为空')
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

  it('多端会话：A、B token 同时可用，A 登出后仅 A 失效', async () => {
    const sessionA = await loginAndGetSession()
    const sessionB = await loginAndGetSession()
    expect(sessionA.key).not.toBe(sessionB.key)
    expect(sessionA.jti).not.toBe(sessionB.jti)
    expect(sessionJtis.get(sessionA.key)).toBe(sessionA.jti)
    expect(sessionJtis.get(sessionB.key)).toBe(sessionB.jti)

    const accessA = await request(httpServer)
      .get('/home')
      .set('Authorization', `Bearer ${sessionA.token}`)
    const accessB = await request(httpServer)
      .get('/home')
      .set('Authorization', `Bearer ${sessionB.token}`)
    expect((accessA.body as { code: number }).code).toBe(0)
    expect((accessB.body as { code: number }).code).toBe(0)

    const logoutA = await request(httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${sessionA.token}`)
    expect(logoutA.status).toBe(200)
    expect(redisMock.del).toHaveBeenCalledWith(sessionA.key)

    const invalidA = await request(httpServer)
      .get('/home')
      .set('Authorization', `Bearer ${sessionA.token}`)
    const validB = await request(httpServer)
      .get('/home')
      .set('Authorization', `Bearer ${sessionB.token}`)
    expect((invalidA.body as { code: number }).code).toBe(401)
    expect((validB.body as { code: number }).code).toBe(0)
  })
})
