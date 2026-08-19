import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { load } from 'js-yaml'
import { Logger } from 'nestjs-pino'
import { RedisService } from './redis.service'

jest.mock('ioredis')

const loggerMock = { error: jest.fn(), info: jest.fn() }

const mockClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
  status: 'ready',
}

describe('RedisService', () => {
  let service: RedisService
  let client: typeof mockClient
  // 构造器注册的 error 事件回调，在 beforeAll 时捕获（afterEach 会清空 mock 调用记录）
  let redisErrorEvent: string
  let redisErrorHandler: (err: Error) => void
  let redisLifecycleHandlers: Map<string, Function>
  let redisOptions: Record<string, any>

  beforeAll(async () => {
    ;(Redis as unknown as jest.Mock).mockImplementation(
      (options: Record<string, unknown>) => {
        redisOptions = options
        return mockClient
      },
    )
    const moduleRef = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: Logger, useValue: loggerMock },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                'redis.host': '127.0.0.1',
                'redis.port': 6379,
                'redis.password': 'root',
                'redis.connectTimeout': 5000,
                'redis.commandTimeout': 3000,
                'redis.maxRetries': 15,
                'redis.retryDelayMax': 2000,
              })[key],
          },
        },
      ],
    }).compile()
    service = moduleRef.get(RedisService)
    client = mockClient
    const [event, handler] = client.on.mock.calls[0] as [
      string,
      (err: Error) => void,
    ]
    redisErrorEvent = event
    redisErrorHandler = handler
    redisLifecycleHandlers = new Map(
      client.on.mock.calls.slice(1) as [string, Function][],
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('config.yaml 包含 Redis 超时和重试配置及中文注释', () => {
    const configPath = resolve(__dirname, '../../config.yaml')
    const content = readFileSync(configPath, 'utf8')
    const config = load(content) as {
      redis: Record<string, number>
    }

    expect(config.redis).toMatchObject({
      connectTimeout: 5000,
      commandTimeout: 3000,
      maxRetries: 5,
      retryDelayMax: 2000,
    })
    expect(content).toContain('# 建立 Redis TCP 连接的超时时间，单位：毫秒')
    expect(content).toContain('# 单条 Redis 命令的超时时间，单位：毫秒')
    expect(content).toContain('# 自动重连的最大尝试次数，达到上限后停止重连但不退出应用')
    expect(content).toContain('# 单次重连退避时间的最大值，单位：毫秒')
  })

  it('@nestjs/terminus 作为运行时依赖声明', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, '../../package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> }

    expect(packageJson.dependencies['@nestjs/terminus']).toBe('^11.1.1')
  })

  it('Redis 构造器接收超时配置和有限重试策略', () => {
    const options = redisOptions
    expect(options).toMatchObject({
      connectTimeout: 5000,
      commandTimeout: 3000,
      maxRetriesPerRequest: 1,
    })
    expect(options.retryStrategy(5)).toBe(1000)
    expect(options.retryStrategy(11)).toBe(2000)
    expect(options.retryStrategy(16)).toBeNull()
  })

  it('ping 转发到底层客户端', async () => {
    client.ping.mockResolvedValue('PONG')
    await expect(service.ping()).resolves.toBe('PONG')
    expect(client.ping).toHaveBeenCalledWith()
  })

  it('生命周期事件被监听并记录 ready/end 日志', () => {
    const handlers = redisLifecycleHandlers
    expect(handlers.has('ready')).toBe(true)
    expect(handlers.has('end')).toBe(true)
    handlers.get('ready')?.()
    handlers.get('end')?.()
    expect(loggerMock.info).toHaveBeenNthCalledWith(1, {
      msg: 'Redis 连接就绪',
    })
    expect(loggerMock.info).toHaveBeenNthCalledWith(2, {
      msg: 'Redis 连接结束',
    })
  })

  it('已结束的客户端不重复 quit', async () => {
    client.status = 'end'
    await service.onApplicationShutdown()
    expect(client.quit).not.toHaveBeenCalled()
  })

  it('正常关闭时调用 quit', async () => {
    client.status = 'ready'
    client.quit.mockResolvedValue('OK')
    await service.onApplicationShutdown()
    expect(client.quit).toHaveBeenCalledWith()
  })
  it('get 转发到底层客户端', async () => {
    client.get.mockResolvedValue('v')
    await expect(service.get('k')).resolves.toBe('v')
    expect(client.get).toHaveBeenCalledWith('k')
  })

  it('set 带 TTL 时透传 EX 参数', async () => {
    client.set.mockResolvedValue('OK')
    await service.set('k', 'v', 100)
    expect(client.set).toHaveBeenCalledWith('k', 'v', 'EX', 100)
  })

  it('set 不带 TTL 时不传过期参数', async () => {
    client.set.mockResolvedValue('OK')
    await service.set('k', 'v')
    expect(client.set).toHaveBeenCalledWith('k', 'v')
  })

  it('del 转发到底层客户端', async () => {
    client.del.mockResolvedValue(1)
    await service.del('k')
    expect(client.del).toHaveBeenCalledWith('k')
  })

  it('Redis error 事件被监听并记录日志', () => {
    expect(redisErrorEvent).toBe('error')
    redisErrorHandler(new Error('connection refused'))
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'Redis 连接错误' }),
    )
  })
})
