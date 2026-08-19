import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import type { Logger } from 'nestjs-pino'

export function configureApplication(
  app: INestApplication,
  logger: Logger,
): void {
  app.useLogger(logger)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
  app.enableShutdownHooks(['SIGTERM', 'SIGINT'])
}
