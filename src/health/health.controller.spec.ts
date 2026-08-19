import { INestApplication, ServiceUnavailableException } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import {
  HealthCheckError,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus'
import { Test } from '@nestjs/testing'
import type { NextFunction, Request as ExpressRequest, Response } from 'express'
import request from 'supertest'
import { Logger } from 'nestjs-pino'
import { AppConfigModule } from '../config/config.module'
import { LoggingModule } from '../common/logging/logging.module'
import { JwtAuthGuard } from '../auth/auth.guard'
import { RedisService } from '../redis/redis.service'
import { HealthController } from './health.controller'
import { HealthModule } from './health.module'
import { RedisHealthIndicator } from './redis-health.indicator'

const healthCheckServiceMock = { check: jest.fn() }
const redisHealthIndicatorMock = { pingCheck: jest.fn() }
const typeOrmHealthIndicatorMock = { pingCheck: jest.fn() }
const loggerMock = { warn: jest.fn() }

describe('HealthController', () => {
  let controller: HealthController

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckServiceMock },
        { provide: RedisHealthIndicator, useValue: redisHealthIndicatorMock },
        {
          provide: TypeOrmHealthIndicator,
          useValue: typeOrmHealthIndicatorMock,
        },
        { provide: Logger, useValue: loggerMock },
      ],
    }).compile()
    controller = moduleRef.get(HealthController)
  })

  afterEach(() => jest.clearAllMocks())

  it('成功时执行 Redis 和数据库检查并返回 Terminus 结果', async () => {
    const result = { status: 'ok', info: {}, error: {}, details: {} }
    healthCheckServiceMock.check.mockResolvedValue(result)

    await expect(controller.health({ id: 'request-1' } as never)).resolves.toBe(
      result,
    )
    expect(healthCheckServiceMock.check).toHaveBeenCalledTimes(1)
    const calls = healthCheckServiceMock.check.mock.calls as unknown as Array<
      [Array<() => Promise<unknown>>]
    >
    const [checks] = calls[0]
    await checks[0]()
    await checks[1]()
    expect(redisHealthIndicatorMock.pingCheck).toHaveBeenCalledWith('redis')
    expect(typeOrmHealthIndicatorMock.pingCheck).toHaveBeenCalledWith(
      'database',
    )
  })

  it('健康检查失败时只记录白名单结果并重新抛出 503 异常', async () => {
    const healthResult = {
      status: 'error',
      info: { database: { status: 'up', connection: 'mysql://secret' } },
      error: { redis: { status: 'down', error: 'Redis unavailable' } },
      details: {
        redis: {
          status: 'down',
          error: 'Redis unavailable',
          stack: 'private stack',
        },
        database: { status: 'up', connection: 'mysql://secret' },
      },
    }
    const error = new ServiceUnavailableException(healthResult)
    healthCheckServiceMock.check.mockRejectedValue(error)

    const safeError: ServiceUnavailableException = await controller
      .health({ id: 'request-2' } as never)
      .catch((caught: ServiceUnavailableException) => caught)
    expect(safeError.getResponse()).toEqual({
      status: 'error',
      info: {},
      error: {},
      details: {
        redis: { status: 'down' },
        database: { status: 'up' },
      },
    })
    expect(safeError.getStatus()).toBe(503)
    expect(loggerMock.warn).toHaveBeenCalledWith(
      {
        path: '/health',
        failedDependencies: ['redis'],
        healthResult: {
          status: 'error',
          details: { redis: { status: 'down' }, database: { status: 'up' } },
        },
        requestId: 'request-2',
      },
      '健康检查失败',
    )
    expect(JSON.stringify(loggerMock.warn.mock.calls[0])).not.toContain(
      'secret',
    )
    expect(JSON.stringify(loggerMock.warn.mock.calls[0])).not.toContain(
      'private stack',
    )
  })

  it('非 Terminus 异常也只记录安全的健康信息', async () => {
    const error = new Error(
      'redis://:secret-password@db.example.test:6379\nprivate stack',
    )
    healthCheckServiceMock.check.mockRejectedValue(error)

    await expect(controller.health({ id: 'request-3' } as never)).rejects.toBe(
      error,
    )
    const [fields] = loggerMock.warn.mock.calls[0] as [Record<string, unknown>]
    expect(fields).toEqual({
      path: '/health',
      failedDependencies: [],
      healthResult: undefined,
      requestId: 'request-3',
    })
    expect(JSON.stringify(fields)).not.toContain('secret-password')
    expect(JSON.stringify(fields)).not.toContain('private stack')
  })

  it('真实 HTTP 层公开访问成功，并在 Redis indicator reject 时返回 Terminus 503 结构', async () => {
    redisHealthIndicatorMock.pingCheck.mockResolvedValue({
      redis: { status: 'up' },
    })
    typeOrmHealthIndicatorMock.pingCheck.mockResolvedValue({
      database: { status: 'up' },
    })
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, LoggingModule, HealthModule],
      providers: [
        { provide: Logger, useValue: loggerMock },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    })
      .overrideProvider(Logger)
      .useValue(loggerMock)
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn() })
      .overrideProvider(RedisHealthIndicator)
      .useValue(redisHealthIndicatorMock)
      .overrideProvider(TypeOrmHealthIndicator)
      .useValue(typeOrmHealthIndicatorMock)
      .compile()
    const app: INestApplication = moduleRef.createNestApplication()
    try {
      app.use(
        (
          req: ExpressRequest & { id?: string },
          _res: Response,
          next: NextFunction,
        ) => {
          req.id =
            typeof req.headers['x-request-id'] === 'string'
              ? req.headers['x-request-id']
              : 'generated-id'
          next()
        },
      )
      await app.init()

      const healthyResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/health')
        .set('x-request-id', 'http-request-1')
        .expect(200)
      expect(healthyResponse.body).toEqual({
        status: 'ok',
        info: { redis: { status: 'up' }, database: { status: 'up' } },
        error: {},
        details: { redis: { status: 'up' }, database: { status: 'up' } },
      })
      expect(healthyResponse.text).not.toMatch(
        /authorization|password|secret|stack/i,
      )
      expect(redisHealthIndicatorMock.pingCheck).toHaveBeenCalledWith('redis')
      expect(typeOrmHealthIndicatorMock.pingCheck).toHaveBeenCalledWith(
        'database',
      )
      expect(loggerMock.warn).not.toHaveBeenCalled()

      redisHealthIndicatorMock.pingCheck.mockRejectedValueOnce(
        new HealthCheckError('Redis unavailable', {
          redis: {
            status: 'down',
            error:
              'redis://:secret-password@db.example.test:6379\nprivate stack',
          },
        }),
      )
      const failedResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/health')
        .set('x-request-id', 'http-request-2')
        .expect(503)
      expect(failedResponse.body).toEqual({
        status: 'error',
        info: {},
        error: {},
        details: {
          redis: { status: 'down' },
          database: { status: 'up' },
        },
      })
      expect(failedResponse.text).not.toMatch(
        /secret-password|db\.example\.test|private stack|password|authorization/i,
      )
      expect(loggerMock.warn).toHaveBeenCalledWith(
        {
          path: '/health',
          failedDependencies: ['redis'],
          healthResult: {
            status: 'error',
            details: {
              redis: { status: 'down' },
              database: { status: 'up' },
            },
          },
          requestId: 'http-request-2',
        },
        '健康检查失败',
      )

      redisHealthIndicatorMock.pingCheck.mockResolvedValueOnce({
        redis: { status: 'up' },
      })
      typeOrmHealthIndicatorMock.pingCheck.mockRejectedValueOnce(
        new HealthCheckError('Database unavailable', {
          database: {
            status: 'down',
            error:
              'mysql://root:secret-password@db.example.test:3306/app\nprivate stack',
          },
        }),
      )
      const databaseFailedResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/health')
        .set('x-request-id', 'http-request-3')
        .expect(503)
      expect(databaseFailedResponse.body).toEqual({
        status: 'error',
        info: {},
        error: {},
        details: {
          redis: { status: 'up' },
          database: { status: 'down' },
        },
      })
      expect(databaseFailedResponse.text).not.toMatch(
        /secret-password|db\.example\.test|private stack|password|authorization/i,
      )
      expect(loggerMock.warn).toHaveBeenCalledWith(
        {
          path: '/health',
          failedDependencies: ['database'],
          healthResult: {
            status: 'error',
            details: {
              redis: { status: 'up' },
              database: { status: 'down' },
            },
          },
          requestId: 'http-request-3',
        },
        '健康检查失败',
      )
    } finally {
      await app.close()
      await moduleRef.close()
    }
  })

  it('健康模块可编译并解析其实际依赖', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, LoggingModule, HealthModule],
    })
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn() })
      .compile()

    expect(moduleRef.get(HealthCheckService)).toBeDefined()
    expect(await moduleRef.resolve(TypeOrmHealthIndicator)).toBeDefined()
    expect(moduleRef.get(RedisHealthIndicator)).toBeDefined()
    await moduleRef.close()
  })

  it('接口标记为公开且使用 Terminus 健康检查装饰器', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const method = HealthController.prototype.health as unknown as object
    const metadata = Reflect.getMetadata('isPublic', method) as boolean
    const headers = Reflect.getMetadata('__headers__', method) as unknown
    expect(metadata).toBe(true)
    expect(headers).toEqual([
      { name: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
    ])
  })
})
