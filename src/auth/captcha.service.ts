import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomInt, randomUUID } from 'node:crypto'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { RedisService } from '../redis/redis.service'

export const CAPTCHA_KEY_PREFIX = 'auth:captcha:'

@Injectable()
export class CaptchaService {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async create(): Promise<{ captchaId: string; image: string }> {
    const captchaId = randomUUID()
    const code = Array.from({ length: 4 }, () => randomInt(0, 10)).join('')
    await this.redisService.set(
      `${CAPTCHA_KEY_PREFIX}${captchaId}`,
      code,
      this.expiresIn(),
    )
    return { captchaId, image: this.toSvg(code) }
  }

  async verify(captchaId: string, captchaCode: string): Promise<void> {
    const key = `${CAPTCHA_KEY_PREFIX}${captchaId}`
    const code = await this.redisService.get(key)
    if (!code || code.toLowerCase() !== captchaCode.toLowerCase()) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '验证码错误或已过期')
    }
    await this.redisService.del(key)
  }

  private expiresIn(): number {
    return this.configService.get<number>('captcha.expiresIn')!
  }

  private toSvg(code: string): string {
    const lines = Array.from({ length: 3 }, (_, index) => {
      const x1 = 10 + index * 45
      const y1 = 15 + randomInt(0, 30)
      const x2 = 150 - index * 35
      const y2 = 15 + randomInt(0, 30)
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#${randomInt(0x100000, 0xffffff).toString(16)}" stroke-width="1"/>`
    }).join('')
    const text = code
      .split('')
      .map(
        (char, index) =>
          `<text x="${18 + index * 30}" y="38" fill="#333" transform="rotate(${randomInt(-15, 16)} ${18 + index * 30} 38)">${char}</text>`,
      )
      .join('')
    return `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="50" viewBox="0 0 150 50"><rect width="150" height="50" fill="#f5f5f5"/>${lines}<g font-family="Arial" font-size="24" font-weight="bold">${text}</g></svg>`).toString('base64')}`
  }
}
