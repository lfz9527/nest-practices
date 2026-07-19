import { Module } from '@nestjs/common'
import { CommonModule } from '../common/common.module'
import { AppConfigModule } from '../config/config.module'
import { DatabaseModule } from '../database/database.module'
import { UsersModule } from '../users/users.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    // 全局配置
    AppConfigModule,
    CommonModule,
    // 数据库连接
    DatabaseModule,
    // 用户模块
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
