import {
  Controller,
  Get,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { Request } from 'express'
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus'
import { Logger } from 'nestjs-pino'
import { Public } from '../auth/public.decorator'
import { RedisHealthIndicator } from './redis-health.indicator'

type HealthRequest = Request & { id?: string }

type HealthResult = {
  status?: string
  details?: Record<string, { status?: 'up' | 'down' }>
}

const getHealthResult = (error: unknown): HealthResult | undefined => {
  if (!(error instanceof ServiceUnavailableException)) {
    return undefined
  }

  const response = error.getResponse()
  if (
    typeof response !== 'object' ||
    response === null ||
    !('details' in response)
  ) {
    return undefined
  }

  const result = response as {
    status?: unknown
    details?: unknown
  }
  const details = result.details
  if (typeof details !== 'object' || details === null) {
    return undefined
  }

  const safeDetails: Record<string, { status: 'up' | 'down' }> = {}
  for (const [name, value] of Object.entries(details)) {
    if (typeof value !== 'object' || value === null) {
      continue
    }
    const status = (value as { status?: unknown }).status
    if (status === 'up' || status === 'down') {
      safeDetails[name] = { status }
    }
  }

  return {
    status: typeof result.status === 'string' ? result.status : undefined,
    details: safeDetails,
  }
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
  async health(@Req() request: HealthRequest) {
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
      if (healthResult) {
        throw new ServiceUnavailableException({
          status: healthResult.status ?? 'error',
          info: {},
          error: {},
          details: healthResult.details,
        })
      }
      throw error
    }
  }
}
