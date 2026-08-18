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
import cookieParser from 'cookie-parser'
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
  let agent: ReturnType<typeof request.agent>
  const userRepo = { findOne: jest.fn(), update: jest.fn() }
  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
  let hashedPassword: string
  let capturedJti: string

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
              jwt: {
                secret: 'test-secret',
                accessExpiresIn: 1800,
                refreshExpiresIn: 604800,
              },
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
    // 与 main.ts 保持一致：cookie-parser 解析 refresh cookie
    app.use(cookieParser())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
    await app.init()
    httpServer = app.getHttpServer() as Server
    agent = request.agent(httpServer)
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

  it('登录：返回 access_token 与 user，Set-Cookie refresh', async () => {
    userRepo.findOne.mockResolvedValue(mockUser())
    userRepo.update.mockResolvedValue({ affected: 1 })
    redisMock.set.mockResolvedValue(undefined)

    const res = await agent.post('/auth/login').send({
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
    const setCookie = res.headers['set-cookie'] as unknown as string[]
    expect(setCookie.join(';')).toContain('refresh=')
    expect(setCookie.join(';')).toContain('HttpOnly')

    // 登录写入 Redis 的 jti 即 refresh token 载荷中的 jti，供刷新用例使用
    expect(redisMock.set).toHaveBeenCalled()
    capturedJti = (redisMock.set.mock.calls[0] as [string, string])[1]
  })

  it('未登录访问受保护接口：401', async () => {
    const res = await request(httpServer).get('/home')
    expect(res.status).toBe(401)
    expect((res.body as { code: number }).code).toBe(401)
  })

  it('携带 access token 访问受保护接口：成功', async () => {
    const loginRes = await agent.post('/auth/login').send({
      email: 'admin@example.com',
      password: '123456',
    })
    const accessToken = (loginRes.body as { data: { access_token: string } })
      .data.access_token
    userRepo.findOne.mockResolvedValue(mockUser())

    const res = await request(httpServer)
      .get('/users/1')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    expect((res.body as { code: number }).code).toBe(0)
  })

  it('刷新：携带 refresh cookie 换新 access', async () => {
    const loginRes = await agent.post('/auth/login').send({
      email: 'admin@example.com',
      password: '123456',
    })
    const oldAccess = (loginRes.body as { data: { access_token: string } }).data
      .access_token
    // 本次登录刚写入的 jti 才与 cookie 中 refresh token 的载荷匹配
    capturedJti = (redisMock.set.mock.calls[0] as [string, string])[1]
    redisMock.get.mockResolvedValue(capturedJti)

    const res = await agent.post('/auth/refresh')
    expect(res.status).toBe(200)
    const data = (res.body as { data: { access_token: string } }).data
    expect(data.access_token).toEqual(expect.any(String))
    expect(data.access_token).not.toBe(oldAccess)
  })
})
