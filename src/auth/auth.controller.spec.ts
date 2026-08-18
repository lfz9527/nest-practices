import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

const authServiceMock = {
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
}

const configMock = {
  get: (key: string) => (key === 'jwt.refreshExpiresIn' ? 604800 : undefined),
}

const resMock = {
  cookie: jest.fn(),
  clearCookie: jest.fn(),
}

describe('AuthController', () => {
  let controller: AuthController

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile()
    controller = moduleRef.get(AuthController)
  })

  afterEach(() => jest.clearAllMocks())

  it('登录：调用 service 并把 refresh 写入 httpOnly cookie', async () => {
    authServiceMock.login.mockResolvedValue({
      access_token: 'at',
      refresh_token: 'rt',
      user: { id: 1 },
    })
    const req = { ip: '10.0.0.1', socket: {} }
    const result = await controller.login(
      { email: 'a@b.com', password: '123456' },
      req as never,
      resMock as never,
    )
    expect(authServiceMock.login).toHaveBeenCalledWith(
      { email: 'a@b.com', password: '123456' },
      '10.0.0.1',
    )
    expect(resMock.cookie).toHaveBeenCalledWith(
      'refresh',
      'rt',
      expect.objectContaining({ httpOnly: true, path: '/auth/refresh' }),
    )
    expect(result).toEqual({ access_token: 'at', user: { id: 1 } })
  })

  it('刷新：无 refresh cookie 抛 401', async () => {
    const req = { cookies: {} }
    await expect(
      controller.refresh(req as never, resMock as never),
    ).rejects.toMatchObject({
      code: 401,
    })
  })

  it('登出：调用 service.logout 并清除 refresh cookie', async () => {
    authServiceMock.logout.mockResolvedValue(undefined)
    const req = { user: { sub: 7 } }
    await controller.logout(req as never, resMock as never)
    expect(authServiceMock.logout).toHaveBeenCalledWith(7)
    expect(resMock.clearCookie).toHaveBeenCalledWith('refresh', {
      path: '/auth/refresh',
    })
  })
})
