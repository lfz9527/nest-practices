import { AppConfigModule } from '../config/config.module'
import { LoggingModule } from '../common/logging/logging.module'
import { HealthCheckService } from '@nestjs/terminus'
import { ServiceUnavailableException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Logger } from 'nestjs-pino'
import { RedisService } from '../redis/redis.service'
import { HealthController } from './health.controller'
import { HealthModule } from './health.module'
import { RedisHealthIndicator } from './redis-health.indicator'
import { TypeOrmHealthIndicator } from '@nestjs/terminus'

const healthCheckServiceMock = {
  check: jest.fn(),
}
const redisHealthIndicatorMock = {
  pingCheck: jest.fn(),
}
const typeOrmHealthIndicatorMock = {
  pingCheck: jest.fn(),
}
const loggerMock = {
  warn: jest.fn(),
}

describe('HealthController', () => {
  let controller: HealthController

  beforeAll(async () => {
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
    const [checks] = healthCheckServiceMock.check.mock.calls[0]
    await checks[0]()
    await checks[1]()
    expect(redisHealthIndicatorMock.pingCheck).toHaveBeenCalledWith('redis')
    expect(typeOrmHealthIndicatorMock.pingCheck).toHaveBeenCalledWith(
      'database',
    )
  })

  it('健康检查失败时解析 ServiceUnavailableException 并保留真实 503 语义', async () => {
    const healthResult = {
      status: 'error',
      info: { database: { status: 'up' } },
      error: { redis: { status: 'down', error: 'Redis unavailable' } },
      details: {
        redis: { status: 'down', error: 'Redis unavailable' },
        database: { status: 'up' },
      },
    }
    const error = new ServiceUnavailableException(healthResult)
    healthCheckServiceMock.check.mockRejectedValue(error)

    await expect(controller.health({ id: 'request-2' } as never)).rejects.toBe(
      error,
    )
    expect(error.getStatus()).toBe(503)
    expect(loggerMock.warn).toHaveBeenCalledWith(
      {
        path: '/health',
        failedDependencies: ['redis'],
        healthResult,
        requestId: 'request-2',
      },
      '健康检查失败',
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
    const [fields] = loggerMock.warn.mock.calls[0]
    expect(fields).toEqual({
      path: '/health',
      failedDependencies: [],
      healthResult: undefined,
      requestId: 'request-3',
    })
    expect(JSON.stringify(fields)).not.toContain('secret-password')
    expect(JSON.stringify(fields)).not.toContain('private stack')
  })

  it('健康模块可编译并解析其实际依赖', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, LoggingModule, HealthModule],
    })
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn() })
      .compile()

    expect(moduleRef.get(HealthCheckService)).toBeDefined()
    expect(moduleRef.resolve(TypeOrmHealthIndicator)).resolves.toBeDefined()
    expect(moduleRef.get(RedisHealthIndicator)).toBeDefined()
  })

  it('接口标记为公开且使用 Terminus 健康检查装饰器', () => {
    const metadata = Reflect.getMetadata('isPublic', HealthController.prototype.health)
    const headers = Reflect.getMetadata(
      '__headers__',
      HealthController.prototype.health,
    )
    expect(metadata).toBe(true)
    expect(headers).toEqual([
      { name: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
    ])
  })
})
