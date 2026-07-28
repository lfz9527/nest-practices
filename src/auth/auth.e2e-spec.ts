import type { Server } from 'node:http'
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../app/app.module'
import type { ResponseBody } from '../common/types'

describe('Auth (e2e)', () => {
  let app: INestApplication
  let httpServer: Server

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
    await app.init()
    httpServer = app.getHttpServer() as Server
  })

  afterAll(async () => {
    await app.close()
  })

  const testUser = {
    nickname: 'e2etest',
    email: `e2e_${Date.now()}@test.com`,
    password: '123456',
  }

  it('POST /auth/register — 注册成功', async () => {
    const res = await request(httpServer)
      .post('/auth/register')
      .send(testUser)
      .expect(200)
    const body = res.body as ResponseBody<{ email: string }>

    expect(body.code).toBe(0)
    expect(body.data.email).toBe(testUser.email)
  })

  it('POST /auth/register — 重复注册返回错误', async () => {
    const res = await request(httpServer)
      .post('/auth/register')
      .send(testUser)
      .expect(200)
    const body = res.body as ResponseBody

    expect(body.code).toBe(-1)
    expect(body.message).toBe('该邮箱已注册')
  })

  it('POST /auth/login_email — 登录成功返回 token 和用户信息', async () => {
    const res = await request(httpServer)
      .post('/auth/login_email')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200)
    const body = res.body as ResponseBody<{
      access_token: string
      user: { email: string }
    }>

    expect(body.code).toBe(0)
    expect(body.data.access_token).toBeDefined()
    expect(body.data.user.email).toBe(testUser.email)
  })

  it('POST /auth/login_email — 密码错误', async () => {
    const res = await request(httpServer)
      .post('/auth/login_email')
      .send({ email: testUser.email, password: 'wrong' })
      .expect(200)
    const body = res.body as ResponseBody

    expect(body.code).toBe(-1)
    expect(body.message).toBe('账号或密码错误')
  })
})
