import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app/app.module'
import { ErrorHandler } from './common/errors/error-handler'

async function bootstrap() {
  // bufferLogs：启动期日志先缓冲，待 pino 接管后统一输出
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const logger = app.get(Logger)
  const configService = app.get(ConfigService)
  const errorHandler = app.get(ErrorHandler)
  const port = configService.get<number>('port') ?? 3000

  app.useLogger(logger)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
  await app.listen(port)

  console.log(`应用已启动: http://localhost:${port}`)

  // 先注册退出动作、再挂进程钩子，保证钩子触发时退出动作必已就绪（规格 §3）
  errorHandler.registerShutdown(async () => {
    await app.close()
    process.exit(1)
  })
  // Promise 悬空拒绝一律转正为 uncaughtException，统一兜底
  process.on('unhandledRejection', (reason) => {
    throw reason
  })
  process.on('uncaughtException', (error) => {
    errorHandler.handleError(error)
  })
}
bootstrap().catch((error: unknown) => {
  // bootstrap 阶段 pino 可能尚未就绪，console 是唯一可靠输出（规格 §5）
  console.error(error)
  process.exit(1)
})
