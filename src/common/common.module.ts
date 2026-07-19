import { Module } from '@nestjs/common'
import { ErrorsModule } from './errors/errors.module'
import { InterceptorsModule } from './interceptors/interceptors.module'

@Module({
  imports: [ErrorsModule, InterceptorsModule],
})
export class CommonModule {}
