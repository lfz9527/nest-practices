import { Module } from '@nestjs/common'
import {
  HealthCheckService,
  TerminusModule,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus'
import { RedisModule } from '../redis/redis.module'
import { LoggingModule } from '../common/logging/logging.module'
import { HealthController } from './health.controller'
import { RedisHealthIndicator } from './redis-health.indicator'

@Module({
  imports: [TerminusModule, RedisModule, LoggingModule],
  controllers: [HealthController],
  providers: [HealthCheckService, RedisHealthIndicator, TypeOrmHealthIndicator],
})
export class HealthModule {}
