import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import { AllExceptionsFilter } from './all-exceptions.filter'
import { ErrorHandler } from './error-handler'

const transport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    // 关闭中文 Unicode 转义 \uXXXX
    translateTime: 'yyyy-MM-dd HH:mm:ss',
    ignore: 'pid,hostname',
    messageKey: 'msg',
    singleLine: true,
    // 强制输出 utf8
    appendNewLine: true,
    escapeJson: false,
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
            transport: pretty ? transport : undefined,
            base: null,
            formatters: {
              log: (record) => record,
            },
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
