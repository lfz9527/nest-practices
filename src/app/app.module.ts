import { Module } from '@nestjs/common'
import { ErrorsModule } from '../common/errors/errors.module'
import { InterceptorsModule } from '../common/interceptors/interceptors.module'
import { AppConfigModule } from '../config/config.module'
import { AuthModule } from '../auth/auth.module'
import { DatabaseModule } from '../database/database.module'
import { RedisModule } from '../redis/redis.module'
import { HealthModule } from '../health/health.module'
import { UsersModule } from '../users/users.module'
import { RolesModule } from '../roles/roles.module'
import { MailModule } from '../mail/mail.module'
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
    // 角色模块
    RolesModule,
    // 认证模块
    AuthModule,
    // 全局 Redis（@Global，供认证等模块注入 RedisService）
    RedisModule,
    // 健康检查
    HealthModule,
    // 邮件发送
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
