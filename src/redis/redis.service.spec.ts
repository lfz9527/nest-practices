import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { Logger } from 'nestjs-pino'
import { RedisService } from './redis.service'

jest.mock('ioredis')

const loggerMock = { error: jest.fn() }

const mockClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
}

describe('RedisService', () => {
  let service: RedisService
  let client: typeof mockClient
  // 构造器注册的 error 事件回调，在 beforeAll 时捕获（afterEach 会清空 mock 调用记录）
  let redisErrorEvent: string
  let redisErrorHandler: (err: Error) => void

  beforeAll(async () => {
    ;(Redis as unknown as jest.Mock).mockImplementation(() => mockClient)
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
  })

  afterEach(() => {
    jest.clearAllMocks()
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
