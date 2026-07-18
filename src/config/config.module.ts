import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { readFileSync } from 'fs'
import { load } from 'js-yaml'
import { resolve } from 'path'

function loadYamlConfig() {
  return load(readFileSync(resolve('config.yaml'), 'utf8')) as Record<
    string,
    unknown
  >
}

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [loadYamlConfig],
      isGlobal: true,
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
