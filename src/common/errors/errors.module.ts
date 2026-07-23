import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import pinoPretty from 'pino-pretty'
import pino from 'pino'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { AllExceptionsFilter } from './all-exceptions.filter'
import { ErrorHandler } from './error-handler'

type RequestWithId = IncomingMessage & {
  id?: string
  ip?: string
}

type ResponseWithStatus = ServerResponse

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const pretty = configService.get<boolean>('logger.pretty')
        const env = configService.get<string>('env')
        const loggerPath = configService.get<string>('logger.file.path')
        const fileEnabled = configService.get<boolean>('logger.file.enabled')

        const stream = pinoPretty({
          colorize: true,
          translateTime: 'yyyy-MM-dd HH:mm:ss',
          ignore: 'pid,hostname',
          singleLine: true,
          destination: process.stdout,
        })

        return {
          pinoHttp: {
            ...(pretty ? { stream } : {}),
            ...(!pretty && fileEnabled
              ? {
                  transport: {
                    targets: [
                      // 普通日志
                      {
                        level: 'info',
                        target: 'pino-roll',
                        options: {
                          file: `${loggerPath}/info/info.log`,
                          frequency: 'daily',
                          size: '20m',
                          mkdir: true,
                          maxSize: '100m',
                          maxFiles: 30,
                          compression: 'gzip',
                          dateFormat: 'yyyy-MM-dd',
                        },
                      },
                      // 错误日志单独存储
                      {
                        level: 'error',
                        target: 'pino-roll',
                        options: {
                          file: `${loggerPath}/error/error.log`,
                          frequency: 'daily',
                          mkdir: true,
                          compression: 'gzip',
                          dateFormat: 'yyyy-MM-dd',
                        },
                      },
                    ],
                  },
                }
              : {}),
            serializers: {
              req: (req: RequestWithId) => ({
                method: req.method,
                url: req.url,
                requestId: req.id || req.headers?.['x-request-id'],
                ip: req.ip || req.headers?.['x-forwarded-for'],
                headers: {
                  'user-agent': req.headers['user-agent'],
                  'content-type': req.headers?.['content-type'],
                },
              }),
              res: (res: ResponseWithStatus) => ({
                statusCode: res.statusCode,
              }),
              err: pino.stdSerializers.err as unknown as (
                err: unknown,
              ) => unknown,
            },

            // 自定义全局字段
            base: {
              environment: env,
            },

            // 自动日志过滤
            autoLogging: {
              ignore: (req) => {
                const ignoredPaths = ['/health', '/ping', '/metrics']
                return ignoredPaths.some((path) => req.url?.startsWith(path))
              },
            },

            // 时间格式
            timestamp: pino.stdTimeFunctions.isoTime,
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
