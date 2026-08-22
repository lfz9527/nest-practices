import { NestFactory } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { hash } from 'bcryptjs'
import { AppModule } from '../app/app.module'
import { Role } from '../roles/role.entity'
import { User } from '../users/user.entity'

// 初始用户配置（按需修改）
const INIT_USER = {
  nickname: 'admin',
  email: '123456@qq.com',
  password: '123456',
}

// 默认角色配置：超级管理员
const INIT_ROLE = {
  name: '超级管理员',
  roleKey: 'admin',
}

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule)
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User))
  const roleRepo = app.get<Repository<Role>>(getRepositoryToken(Role))

  // 初始化默认角色（幂等：已存在则复用）
  let adminRole = await roleRepo.findOne({
    where: { roleKey: INIT_ROLE.roleKey, delFlag: 0 },
  })
  if (!adminRole) {
    adminRole = await roleRepo.save(roleRepo.create(INIT_ROLE))
    console.log(`默认角色创建成功: ${INIT_ROLE.roleKey}`)
  }

  const existing = await userRepo.findOne({ where: { email: INIT_USER.email } })
  if (existing) {
    // 初始用户已存在时保证绑定默认角色（幂等）
    if (Number(existing.roleId) !== Number(adminRole.id)) {
      await userRepo.update(existing.id, { roleId: adminRole.id })
      console.log(`初始用户 ${INIT_USER.email} 已绑定默认角色`)
    } else {
      console.log(`初始用户 ${INIT_USER.email} 已存在，跳过创建`)
    }
    await app.close()
    return
  }

  const hashedPassword = await hash(INIT_USER.password, 10)
  await userRepo.save(
    userRepo.create({
      nickname: INIT_USER.nickname,
      email: INIT_USER.email,
      password: hashedPassword,
      roleId: adminRole.id,
    }),
  )

  console.log(`初始用户创建成功: ${INIT_USER.email}`)
  await app.close()
}

void seed()
