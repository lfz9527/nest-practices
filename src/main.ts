import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app/app.module'
import { ErrorHandler } from './common/errors/error-handler'

async function bootstrap() {
  // bufferLogs：启动期日志先缓冲，待 pino 接管后统一输出
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))

  const errorHandler = app.get(ErrorHandler)
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

  const configService = app.get(ConfigService)
  await app.listen(configService.get<number>('port') ?? 3000)
}
bootstrap().catch((error: unknown) => {
  // bootstrap 阶段 pino 可能尚未就绪，console 是唯一可靠输出（规格 §5）
  console.error(error)
  process.exit(1)
})
