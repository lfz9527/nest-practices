import { Module } from '@nestjs/common'
import { ErrorsModule } from '../common/errors/errors.module'
import { InterceptorsModule } from '../common/interceptors/interceptors.module'
import { AppConfigModule } from '../config/config.module'
import { DatabaseModule } from '../database/database.module'
import { UsersModule } from '../users/users.module'
import { AuthModule } from '../auth/auth.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    // 全局配置
    AppConfigModule,
    // 错误
    ErrorsModule,
    // 拦截器模块
    InterceptorsModule,
    // 数据库连接
    DatabaseModule,
    // 用户模块
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
