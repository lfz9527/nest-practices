import type { Server } from 'node:http'

import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { hash } from 'bcryptjs'
import { PinoLogger } from 'nestjs-pino'
import request from 'supertest'
import { AuthController } from '../auth/auth.controller'
import { JwtAuthGuard } from '../auth/auth.guard'
import { AuthService } from '../auth/auth.service'
import { CaptchaService } from '../auth/captcha.service'
import { JwtStrategy } from '../auth/jwt.strategy'
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter'
import { ErrorHandler } from '../common/errors/error-handler'
import { TransformInterceptor } from '../common/interceptors/transform.interceptor'
import { RedisService } from '../redis/redis.service'
import { User } from '../users/user.entity'
import { Role } from './role.entity'
import { RolesController } from './roles.controller'
import { RolesService } from './roles.service'

describe('角色模块 E2E', () => {
  let app: INestApplication
  let httpServer: Server
  const userRepo = { findOne: jest.fn(), update: jest.fn() }
  const roleRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  }
  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
  // 内存会话存储：模拟 Redis，登录写入 jti，守卫按 token.sessionId 比对
  const sessionJtis = new Map<string, string>()
  let hashedPassword: string

  beforeEach(() => {
    jest.clearAllMocks()
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
      controllers: [AuthController, RolesController],
      providers: [
        AuthService,
        { provide: CaptchaService, useValue: { verify: jest.fn() } },
        RolesService,
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
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

  // 登录 helper：用户无角色（不触发角色关联查询）
  const loginAndGetToken = async () => {
    userRepo.findOne.mockResolvedValue({
      id: 1,
      nickname: '甄嬛',
      email: 'admin@example.com',
      password: hashedPassword,
      status: 0,
      delFlag: 0,
      lastLoginIp: '',
      lastLoginTime: null,
    })
    userRepo.update.mockResolvedValue({ affected: 1 })
    const res = await request(httpServer).post('/auth/login').send({
      email: 'admin@example.com',
      password: '123456',
      captchaId: 'captcha-id',
      captchaCode: '1234',
    })
    return (res.body as { data: { access_token: string } }).data.access_token
  }

  const mockRole = (overrides: Partial<Role> = {}): Role => ({
    id: 1,
    name: '管理员',
    roleKey: 'admin',
    status: 0,
    sort: 0,
    remark: '',
    delFlag: 0,
    createdAt: new Date('2026-08-22T00:00:00Z'),
    updatedAt: new Date('2026-08-22T00:00:00Z'),
    ...overrides,
  })

  it('未登录访问 /roles：业务错误形态 401', async () => {
    const res = await request(httpServer).get('/roles')
    expect(res.status).toBe(200)
    expect((res.body as { code: number }).code).toBe(401)
  })

  it('GET /roles 分页列表：返回 { list, total }', async () => {
    const token = await loginAndGetToken()
    roleRepo.findAndCount.mockResolvedValue([[mockRole()], 1])

    const res = await request(httpServer)
      .get('/roles?page=1&pageSize=10&name=管')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const body = res.body as {
      code: number
      data: { list: Role[]; total: number }
    }
    expect(body.code).toBe(0)
    expect(body.data.total).toBe(1)
    expect(body.data.list[0].roleKey).toBe('admin')
  })

  it('GET /roles/:id 详情：成功与不存在', async () => {
    const token = await loginAndGetToken()

    roleRepo.findOne.mockResolvedValue(mockRole())
    const ok = await request(httpServer)
      .get('/roles/1')
      .set('Authorization', `Bearer ${token}`)
    expect(ok.status).toBe(200)
    expect((ok.body as { code: number }).code).toBe(0)
    expect((ok.body as { data: Role }).data.name).toBe('管理员')

    roleRepo.findOne.mockResolvedValue(null)
    const missing = await request(httpServer)
      .get('/roles/999')
      .set('Authorization', `Bearer ${token}`)
    expect((missing.body as { code: number }).code).toBe(-1)
    expect((missing.body as { message: string }).message).toBe(
      '角色 999 不存在',
    )
  })

  it('POST /roles 创建成功：返回角色，HTTP 200', async () => {
    const token = await loginAndGetToken()
    roleRepo.findOne.mockResolvedValue(null)
    roleRepo.create.mockReturnValue(
      mockRole({ name: '测试角色', roleKey: 'test' }),
    )
    roleRepo.save.mockResolvedValue(
      mockRole({ name: '测试角色', roleKey: 'test' }),
    )

    const res = await request(httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '测试角色', roleKey: 'test' })

    expect(res.status).toBe(200)
    const body = res.body as { code: number; data: Role }
    expect(body.code).toBe(0)
    expect(body.data.roleKey).toBe('test')
  })

  it('POST /roles roleKey 重复：业务错误 code -1', async () => {
    const token = await loginAndGetToken()
    roleRepo.findOne.mockResolvedValue(mockRole())

    const res = await request(httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '管理员', roleKey: 'admin' })

    expect(res.status).toBe(200)
    const body = res.body as { code: number; message: string }
    expect(body.code).toBe(-1)
    expect(body.message).toBe('角色编码 admin 已存在')
  })

  it('POST /roles 参数校验失败：HTTP 200 + code -1', async () => {
    const token = await loginAndGetToken()

    const res = await request(httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ roleKey: 'x' })

    expect(res.status).toBe(200)
    expect((res.body as { code: number }).code).toBe(-1)
    expect((res.body as { message: string }).message).toContain(
      '角色名称不能为空',
    )
  })

  it('POST /roles/update 更新成功', async () => {
    const token = await loginAndGetToken()
    roleRepo.findOne
      .mockResolvedValueOnce(mockRole())
      .mockResolvedValueOnce(mockRole({ name: '超级管理员' }))
    roleRepo.update.mockResolvedValue({ affected: 1 })

    const res = await request(httpServer)
      .post('/roles/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 1, name: '超级管理员', status: 1, sort: 10, remark: '核心' })

    expect(res.status).toBe(200)
    const body = res.body as { code: number; data: Role }
    expect(body.code).toBe(0)
    expect(body.data.name).toBe('超级管理员')
  })

  it('POST /roles/delete 删除：软删除并置空用户引用', async () => {
    const token = await loginAndGetToken()
    roleRepo.findOne.mockResolvedValue(mockRole())
    roleRepo.update.mockResolvedValue({ affected: 1 })
    userRepo.update.mockResolvedValue({ affected: 1 })

    const res = await request(httpServer)
      .post('/roles/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 1 })

    expect(res.status).toBe(200)
    expect((res.body as { code: number }).code).toBe(0)
    expect(roleRepo.update).toHaveBeenCalledWith(1, { delFlag: 2 })
    expect(userRepo.update).toHaveBeenCalledWith(
      { roleId: 1 },
      { roleId: null },
    )
  })
})
