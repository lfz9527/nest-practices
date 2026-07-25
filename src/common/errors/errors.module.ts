import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'

import { AllExceptionsFilter } from './all-exceptions.filter'
import { ErrorHandler } from './error-handler'
import { LoggingModule } from '../logging/logging.module'

@Module({
  imports: [LoggingModule],
  providers: [
    ErrorHandler,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
  exports: [ErrorHandler],
})
export class ErrorsModule {}
