import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import { AllExceptionsFilter } from './all-exceptions.filter'
import { ErrorHandler } from './error-handler'

const prettyTransport = {
  target: 'pino-pretty',
  level: 'info',
  options: {
    colorize: true,
    translateTime: 'yyyy-MM-dd HH:mm:ss',
    ignore: 'pid,hostname',
    singleLine: true,
  },
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const pretty = configService.get<boolean>('logger.pretty')

        return {
          pinoHttp: {
            // 开发期经 pino-pretty 输出可读日志；生产置 false 保持 JSON 到 stdout
            transport: pretty ? prettyTransport : undefined,
          },
        }
      },
    }),
  ],
  providers: [
    ErrorHandler,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
  exports: [ErrorHandler],
})
export class ErrorsModule {}
