import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { JwtAuthGuard } from './auth.guard'
import { JwtStrategy } from './jwt.strategy'

const reflectorMock = { getAllAndOverride: jest.fn() }
const contextMock = {
  getHandler: jest.fn(),
  getClass: jest.fn(),
  // switchToHttp 使 super.canActivate 能真正跑 passport 校验，而非缺方法抛 TypeError
  switchToHttp: () => ({
    getRequest: () => ({ headers: {}, cookies: {} }),
    getResponse: () => ({}),
  }),
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard

  beforeAll(() => {
    // 注册 jwt 策略：无 Authorization 头时 passport 走 fail → handleRequest 抛业务 401
    new JwtStrategy({
      get: (key: string) => (key === 'jwt.secret' ? 'test-secret' : undefined),
    } as unknown as ConfigService)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    guard = new JwtAuthGuard(reflectorMock as unknown as Reflector)
  })

  it('@Public 标记的接口直接放行', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true)
    const result = guard.canActivate(contextMock as never)
    expect(result).toBe(true)
    expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
      contextMock.getHandler(),
      contextMock.getClass(),
    ])
  })

  it('未标记 @Public 的接口走 JWT 验证（super.canActivate）', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false)
    // 无有效 token 时 handleRequest 抛业务 AppError（HTTP 200 + body.code 401）
    await expect(guard.canActivate(contextMock as never)).rejects.toMatchObject(
      {
        code: 401,
      },
    )
  })
})
