import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import pinoPretty from 'pino-pretty'
import { AllExceptionsFilter } from './all-exceptions.filter'
import { ErrorHandler } from './error-handler'

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const pretty = configService.get<boolean>('logger.pretty')
        const env = configService.get<string>('env')

        if (pretty && env === 'development') {
          // 主线程使用 pino-pretty stream 而非 transport worker thread。
          // transport worker thread 通过 fs.writeSync(fd) 写原始字节到 stdout，
          // 在 Windows 上绕过 Node.js 的 TTY 编码适配层（WriteConsoleW），
          // 导致 UTF-8 中文被 PowerShell 以 GBK 解码而乱码。
          // stream + destination: process.stdout 走 process.stdout.write()，
          // 与 console.log 同一条链路，中文正常。
          const stream = pinoPretty({
            colorize: true,
            translateTime: 'yyyy-MM-dd HH:mm:ss',
            ignore: 'pid,hostname',
            singleLine: true,
            destination: process.stdout,
          })
          return { pinoHttp: { stream } }
        }

        return { pinoHttp: {} }
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
