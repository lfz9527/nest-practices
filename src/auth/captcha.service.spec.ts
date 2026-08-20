import { ConfigService } from '@nestjs/config'
import { CaptchaService, CAPTCHA_KEY_PREFIX } from './captcha.service'
import { RedisService } from '../redis/redis.service'

describe('CaptchaService', () => {
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
  const config = { get: jest.fn().mockReturnValue(300) }
  const service = new CaptchaService(
    config as unknown as ConfigService,
    redis as unknown as RedisService,
  )

  afterEach(() => jest.clearAllMocks())

  it('生成验证码并写入带过期时间的 Redis', async () => {
    const result = await service.create()
    expect(result.captchaId).toEqual(expect.any(String))
    expect(result.image).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(redis.set).toHaveBeenCalledWith(
      `${CAPTCHA_KEY_PREFIX}${result.captchaId}`,
      expect.stringMatching(/^\d{4}$/),
      300,
    )
  })

  it('验证码正确时删除记录', async () => {
    redis.get.mockResolvedValue('12Ab')
    await service.verify('id', '12ab')
    expect(redis.del).toHaveBeenCalledWith(`${CAPTCHA_KEY_PREFIX}id`)
  })

  it('验证码不存在或错误时拒绝', async () => {
    redis.get.mockResolvedValue(null)
    await expect(service.verify('id', '1234')).rejects.toMatchObject({
      code: -1,
      message: '验证码错误或已过期',
    })
    expect(redis.del).not.toHaveBeenCalled()
  })
})
