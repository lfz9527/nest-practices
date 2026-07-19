import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import { AllExceptionsFilter } from './all-exceptions.filter'
import { ErrorHandler } from './error-handler'
import { TransformInterceptor } from './transform.interceptor'

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          // 开发期经 pino-pretty 输出可读日志；生产置 false 保持 JSON 到 stdout
          transport: configService.get<boolean>('logger.pretty')
            ? { target: 'pino-pretty' }
            : undefined,
        },
      }),
    }),
  ],
  providers: [
    ErrorHandler,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
  exports: [ErrorHandler],
})
export class CommonModule {}
