import { HealthCheckError, HealthCheckService } from '@nestjs/terminus'
import { Test } from '@nestjs/testing'
import { Logger } from 'nestjs-pino'
import { RedisHealthIndicator } from './redis-health.indicator'
import { HealthController } from './health.controller'
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

  it('健康检查失败时记录结构化日志并原样抛出 HealthCheckError', async () => {
    const error = new HealthCheckError('Health check failed', {
      redis: { status: 'down' },
      database: { status: 'up' },
    })
    healthCheckServiceMock.check.mockRejectedValue(error)

    await expect(controller.health({ id: 'request-2' } as never)).rejects.toBe(
      error,
    )
    expect(loggerMock.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/health',
        failedDependencies: ['redis'],
        healthResult: error.causes,
        requestId: 'request-2',
        err: error,
      }),
      '健康检查失败',
    )
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
