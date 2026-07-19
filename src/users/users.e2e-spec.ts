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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController, BoomController],
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
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

    expect(body).toEqual({ code: 0, message: 'ok', data: user })
  })

  it('GET /users/999 用户不存在：HTTP 200 与业务码 40401', async () => {
    userRepo.findOne.mockResolvedValue(null)

    const res = await request(httpServer).get('/users/999').expect(200)
    const body = res.body as { code: number; message: string; data: unknown }

    expect(body).toEqual({
      code: 40401,
      message: '用户 999 不存在',
      data: null,
    })
  })

  it('GET /users/abc 参数非法：400 与推导码 40000', async () => {
    const res = await request(httpServer).get('/users/abc').expect(400)
    const body = res.body as { code: number; message: string; data: unknown }

    expect(body).toMatchObject({ code: 40000, data: null })
  })

  it('GET /boom 未知异常：500 与兜底码 50000，不泄露内部信息', async () => {
    const res = await request(httpServer).get('/boom').expect(500)
    const body = res.body as { code: number; message: string; data: unknown }

    expect(body).toEqual({
      code: 50000,
      message: '服务器内部错误',
      data: null,
    })
  })
})
