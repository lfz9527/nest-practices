import { Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { Logger } from 'nestjs-pino'

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly client: Redis

  constructor(
    configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.client = new Redis({
      host: configService.get<string>('redis.host'),
      port: configService.get<number>('redis.port'),
      password: configService.get<string>('redis.password') || undefined,
      connectTimeout: configService.get<number>('redis.connectTimeout'),
      commandTimeout: configService.get<number>('redis.commandTimeout'),
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => {
        const maxRetries = configService.get<number>('redis.maxRetries') ?? 5
        const retryDelayMax =
          configService.get<number>('redis.retryDelayMax') ?? 2000
        return times > maxRetries ? null : Math.min(times * 200, retryDelayMax)
      },
    })
    // 未捕获的 error 事件会让 ioredis 抛出导致进程崩溃，必须监听
    this.client.on('error', (err) => {
      this.logger.error({ msg: 'Redis 连接错误', err })
    })
    this.client.on('ready', () => {
      this.logger.log({ msg: 'Redis 连接就绪' })
    })
    this.client.on('end', () => {
      this.logger.log({ msg: 'Redis 连接结束' })
    })
  }

  async ping(): Promise<'PONG'> {
    return this.client.ping()
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, 'EX', ttlSeconds)
    } else {
      await this.client.set(key, value)
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status === 'end' || this.client.status === 'close') {
      return
    }
    await this.client.quit()
  }
}
