import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { RedisService } from '../redis/redis.service'
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
    new JwtStrategy(
      {
        get: (key: string) =>
          key === 'jwt.secret' ? 'test-secret' : undefined,
      } as unknown as ConfigService,
      { get: jest.fn() } as unknown as RedisService,
    )
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

  it('JWT 会话 jti 匹配时放行', async () => {
    const redisService = { get: jest.fn().mockResolvedValue('jti-1') }
    const strategy = new JwtStrategy(
      {
        get: (key: string) =>
          key === 'jwt.secret' ? 'test-secret' : undefined,
      } as unknown as ConfigService,
      redisService as unknown as RedisService,
    )

    await expect(
      strategy.validate({
        sub: 7,
        email: 'a@b.com',
        sessionId: 'session-1',
        jti: 'jti-1',
        type: 'access',
      }),
    ).resolves.toMatchObject({ sessionId: 'session-1' })
    expect(redisService.get).toHaveBeenCalledWith('auth:session:7:session-1')
  })

  it.each([null, 'other-jti'])(
    'JWT 会话缺失或 jti 不匹配时拒绝（Redis value: %s）',
    async (storedJti) => {
      const redisService = { get: jest.fn().mockResolvedValue(storedJti) }
      const strategy = new JwtStrategy(
        {
          get: (key: string) =>
            key === 'jwt.secret' ? 'test-secret' : undefined,
        } as unknown as ConfigService,
        redisService as unknown as RedisService,
      )

      await expect(
        strategy.validate({
          sub: 7,
          email: 'a@b.com',
          sessionId: 'session-1',
          jti: 'jti-1',
          type: 'access',
        }),
      ).rejects.toMatchObject({ code: 401, message: '未登录或登录状态过期' })
    },
  )
})
