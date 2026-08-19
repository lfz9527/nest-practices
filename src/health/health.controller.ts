import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus'
import { Logger } from 'nestjs-pino'
import { Public } from '../auth/public.decorator'
import { RedisHealthIndicator } from './redis-health.indicator'

type HealthRequest = { id?: string }

type HealthResult = {
  status?: string
  info?: Record<string, { status?: string }>
  error?: Record<string, { status?: string }>
  details?: Record<string, { status?: string }>
}

const getHealthResult = (error: unknown): HealthResult | undefined => {
  if (!(error instanceof ServiceUnavailableException)) {
    return undefined
  }

  const response = error.getResponse()
  if (typeof response === 'object' && response !== null && 'details' in response) {
    return response as HealthResult
  }
  return undefined
}

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
      const healthResult = getHealthResult(error)
      const failedDependencies = Object.entries(healthResult?.details ?? {})
        .filter(([, result]) => result.status === 'down')
        .map(([name]) => name)

      this.logger.warn(
        {
          path: '/health',
          failedDependencies,
          healthResult,
          requestId: request.id,
        },
        '健康检查失败',
      )
      throw error
    }
  }
}
