import { NestFactory } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { hash } from 'bcryptjs'
import { AppModule } from '../app/app.module'
import { User } from '../users/user.entity'

// 初始用户配置（按需修改）
const INIT_USER = {
  nickname: 'admin',
  email: 'admin@example.com',
  password: '123456',
}

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule)
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User))

  const existing = await userRepo.findOne({ where: { email: INIT_USER.email } })
  if (existing) {
    console.log(`初始用户 ${INIT_USER.email} 已存在，跳过创建`)
    await app.close()
    return
  }

  const hashedPassword = await hash(INIT_USER.password, 10)
  await userRepo.save(
    userRepo.create({
      nickname: INIT_USER.nickname,
      email: INIT_USER.email,
      password: hashedPassword,
    }),
  )

  console.log(`初始用户创建成功: ${INIT_USER.email}`)
  await app.close()
}

void seed()
