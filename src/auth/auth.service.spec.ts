import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { getRepositoryToken } from '@nestjs/typeorm'
import { hash } from 'bcryptjs'
import { User } from '../users/user.entity'
import { RedisService } from '../redis/redis.service'
import { AuthService, SESSION_KEY_PREFIX } from './auth.service'

const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}

const jwtMock = {
  signAsync: jest.fn(),
}

const userRepoMock = {
  findOne: jest.fn(),
  update: jest.fn(),
}

const configMock = {
  get: (key: string) =>
    ({
      'jwt.accessExpiresIn': 604800,
    })[key],
}

describe('AuthService', () => {
  let service: AuthService
  let hashedPassword: string

  beforeAll(async () => {
    hashedPassword = await hash('123456', 10)
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile()
    service = moduleRef.get(AuthService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const buildUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 1,
      nickname: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      status: 0,
      delFlag: 0,
      lastLoginIp: '',
      lastLoginTime: null,
      ...overrides,
    }) as User

  it('登录成功：签发单 access token、jti 写入 Redis 会话、更新登录信息', async () => {
    userRepoMock.findOne.mockResolvedValue(buildUser())
    jwtMock.signAsync.mockResolvedValue('access-token')
    redisMock.set.mockResolvedValue(undefined)
    userRepoMock.update.mockResolvedValue({ affected: 1 })

    const result = await service.login(
      { email: 'admin@example.com', password: '123456' },
      '127.0.0.1',
    )

    expect(result.access_token).toBe('access-token')
    expect(result).not.toHaveProperty('refresh_token')
    expect(result.user).not.toHaveProperty('password')
    // 载荷携带 jti 供守卫比对
    expect(jwtMock.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 1,
        email: 'admin@example.com',
        jti: expect.any(String) as string,
      }),
      expect.anything(),
    )
    expect(redisMock.set).toHaveBeenCalledWith(
      `${SESSION_KEY_PREFIX}1`,
      expect.any(String),
      604800,
    )
    expect(userRepoMock.update).toHaveBeenCalledWith(1, {
      lastLoginIp: '127.0.0.1',
      lastLoginTime: expect.any(Date) as Date,
    })
  })

  it('登录失败：邮箱不存在抛 BIZ_ERROR 且文案不暴露账号状态', async () => {
    userRepoMock.findOne.mockResolvedValue(null)
    await expect(
      service.login({ email: 'x@y.com', password: '123456' }, ''),
    ).rejects.toMatchObject({ code: -1, message: '账号或密码错误' })
    expect(redisMock.set).not.toHaveBeenCalled()
  })

  it('登录失败：密码错误', async () => {
    userRepoMock.findOne.mockResolvedValue(buildUser())
    await expect(
      service.login({ email: 'admin@example.com', password: 'wrong' }, ''),
    ).rejects.toMatchObject({ code: -1, message: '账号或密码错误' })
  })

  it('登录失败：账号停用', async () => {
    userRepoMock.findOne.mockResolvedValue(buildUser({ status: 1 }))
    await expect(
      service.login({ email: 'admin@example.com', password: '123456' }, ''),
    ).rejects.toMatchObject({ code: -1, message: '账号已被停用' })
  })

  it('登出：删除 Redis 中的会话 jti', async () => {
    redisMock.del.mockResolvedValue(1)
    await service.logout(1)
    expect(redisMock.del).toHaveBeenCalledWith(`${SESSION_KEY_PREFIX}1`)
  })
})
