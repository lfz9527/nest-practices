import { Controller, Get } from '@nestjs/common'
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus'
import { Logger } from 'nestjs-pino'
import { Public } from '../auth/public.decorator'
import { RedisHealthIndicator } from './redis-health.indicator'

type HealthRequest = { id?: string }

type HealthResult = Record<string, { status?: string }>

@Controller()
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly redisHealthIndicator: RedisHealthIndicator,
    private readonly typeOrmHealthIndicator: TypeOrmHealthIndicator,
    private readonly logger: Logger,
  ) {}

  @Get('health')
  @Public()
  @HealthCheck()
  async health(request: HealthRequest) {
    try {
      return await this.healthCheckService.check([
        () => this.redisHealthIndicator.pingCheck('redis'),
        () => this.typeOrmHealthIndicator.pingCheck('database'),
      ])
    } catch (error) {
      const healthResult =
        error instanceof HealthCheckError
          ? (error.causes as unknown as HealthResult)
          : undefined
      const failedDependencies = Object.entries(healthResult ?? {})
        .filter(([, result]) => result.status === 'down')
        .map(([name]) => name)

      this.logger.warn(
        {
          path: '/health',
          failedDependencies,
          healthResult,
          requestId: request.id,
          err: error as unknown,
        },
        '健康检查失败',
      )
      throw error
    }
  }
}
