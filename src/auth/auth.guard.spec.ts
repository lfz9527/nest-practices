import { Reflector } from '@nestjs/core'
import { JwtAuthGuard } from './auth.guard'

const reflectorMock = { getAllAndOverride: jest.fn() }
const contextMock = { getHandler: jest.fn(), getClass: jest.fn() }

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard

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

  it('未标记 @Public 的接口走 JWT 验证（super.canActivate）', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false)
    // 无有效 token 时 AuthGuard('jwt') 抛 UnauthorizedException，此处验证进入 JWT 验证路径
    const result = guard.canActivate(contextMock as never)
    expect(result).toBeInstanceOf(Promise)
    return expect(result).rejects.toThrow()
  })
})
