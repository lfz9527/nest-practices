import { Module } from '@nestjs/common'
import { AppConfigModule } from '../config/config.module'
import { DatabaseModule } from '../database/database.module'
import { UsersModule } from '../users/users.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [AppConfigModule, DatabaseModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
