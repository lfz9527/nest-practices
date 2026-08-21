import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { Logger } from 'nestjs-pino'

export function configureApplication(
  app: INestApplication,
  logger: Logger,
): void {
  app.useLogger(logger)
  // 浏览器标签页会自动请求 /favicon.ico，直接 204 短路，
  // 避免进入全局守卫产生无效鉴权与日志噪音
  app.use('/favicon.ico', (_req: Request, res: Response) => {
    res.status(204).end()
  })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
  app.enableShutdownHooks(['SIGTERM', 'SIGINT'])
}
