import { Injectable } from '@nestjs/common'
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus'
import { RedisService } from '../redis/redis.service'

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redisService: RedisService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redisService.ping()
      return this.healthIndicatorService.check(key).up()
    } catch {
      return this.healthIndicatorService
        .check(key)
        .down({ error: 'Redis unavailable' })
    }
  }
}
