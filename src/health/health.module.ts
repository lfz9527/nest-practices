import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { LoggingModule } from '../common/logging/logging.module'
import { DatabaseModule } from '../database/database.module'
import { RedisModule } from '../redis/redis.module'
import { HealthController } from './health.controller'
import { RedisHealthIndicator } from './redis-health.indicator'

@Module({
  imports: [
    TerminusModule.forRoot({ logger: false }),
    RedisModule,
    DatabaseModule,
    LoggingModule,
  ],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
