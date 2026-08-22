import type { Server } from 'node:http'

import {
  Controller,
  Get,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { PinoLogger } from 'nestjs-pino'
import request from 'supertest'
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter'
import { ErrorHandler } from '../common/errors/error-handler'
import { TransformInterceptor } from '../common/interceptors/transform.interceptor'
import { Role } from '../roles/role.entity'
import { User } from './user.entity'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

// 专供 500 用例的抛错控制器，仅注册在测试模块（规格 §6）
@Controller('boom')
class BoomController {
  @Get()
  boom(): never {
    throw new Error('boom')
  }
}

describe('错误处理 E2E', () => {
  let app: INestApplication
  let httpServer: Server
  const userRepo = { findOne: jest.fn() }
  const roleRepo = { findOne: jest.fn() }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController, BoomController],
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        // 桩掉日志：e2e 只验响应契约，不落真实日志
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
    // 与 main.ts 保持一致的全局管道配置
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
    await app.init()
    httpServer = app.getHttpServer() as Server
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /users/1 成功：统一包裹 { code: 0, message: ok, data }', async () => {
    const user = { id: 1, nickname: '甄嬛', delFlag: 0 }
    userRepo.findOne.mockResolvedValue(user)

    const res = await request(httpServer).get('/users/1').expect(200)
    const body = res.body as { code: number; message: string; data: unknown }

    expect(body).toEqual({
      code: 0,
      message: 'ok',
      data: { ...user, role: null },
    })
  })

  it('GET /users/1 用户带角色：data.role 返回 { id, name, roleKey }', async () => {
    userRepo.findOne.mockResolvedValue({ id: 1, nickname: '甄嬛', roleId: 5 })
    roleRepo.findOne.mockResolvedValue({
      id: 5,
      name: '管理员',
      roleKey: 'admin',
    })

    const res = await request(httpServer).get('/users/1').expect(200)
    const body = res.body as {
      code: number
      data: { role: { id: number; name: string; roleKey: string } }
    }

    expect(body.code).toBe(0)
    expect(body.data.role).toEqual({ id: 5, name: '管理员', roleKey: 'admin' })
  })

  it('GET /users/999 用户不存在：HTTP 200 与业务码 -1', async () => {
    userRepo.findOne.mockResolvedValue(null)

    const res = await request(httpServer).get('/users/999').expect(200)
    const body = res.body as { code: number; message: string; data: unknown }

    expect(body).toEqual({
      code: -1,
      message: '用户 999 不存在',
      data: null,
    })
  })

  it('GET /users/abc 参数非法：校验异常按业务错误形态返回（HTTP 200 + code -1）', async () => {
    const res = await request(httpServer).get('/users/abc').expect(200)
    const body = res.body as { code: number; message: string; data: unknown }

    expect(body).toMatchObject({ code: -1, data: null })
  })

  it('GET /boom 未知异常：500 与业务码 500，不泄露内部信息', async () => {
    const res = await request(httpServer).get('/boom').expect(500)
    const body = res.body as { code: number; message: string; data: unknown }

    expect(body).toEqual({
      code: 500,
      message: '服务器内部错误',
      data: null,
    })
  })
})
