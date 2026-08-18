import { Test } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

const authServiceMock = {
  login: jest.fn(),
  logout: jest.fn(),
}

describe('AuthController', () => {
  let controller: AuthController

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compile()
    controller = moduleRef.get(AuthController)
  })

  afterEach(() => jest.clearAllMocks())

  it('登录：调用 service 并原样返回结果', async () => {
    authServiceMock.login.mockResolvedValue({
      access_token: 'at',
      user: { id: 1 },
    })
    const req = { ip: '10.0.0.1', socket: {} }
    const result = await controller.login(
      { email: 'a@b.com', password: '123456' },
      req as never,
    )
    expect(authServiceMock.login).toHaveBeenCalledWith(
      { email: 'a@b.com', password: '123456' },
      '10.0.0.1',
    )
    expect(result).toEqual({ access_token: 'at', user: { id: 1 } })
  })

  it('登出：调用 service.logout', async () => {
    authServiceMock.logout.mockResolvedValue(undefined)
    const req = { user: { sub: 7, sessionId: 'session-7' } }
    await controller.logout(req as never)
    expect(authServiceMock.logout).toHaveBeenCalledWith(7, 'session-7')
  })
})
