import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { Public } from './public.decorator'

// refresh token 的 cookie 名与路径：仅 /auth/refresh 请求自动携带
export const REFRESH_COOKIE = 'refresh'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? ''
    const result = await this.authService.login(loginDto, ip)
    this.setRefreshCookie(res, result.refresh_token)
    const { refresh_token: _rt, ...rest } = result
    void _rt
    return rest
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE]
    if (!refreshToken) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, '缺少 refresh token')
    }
    const result = await this.authService.refresh(refreshToken)
    this.setRefreshCookie(res, result.refresh_token)
    const { refresh_token: _rt, ...rest } = result
    void _rt
    return rest
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request) {
    // 登出需已登录（走全局守卫），从 access token 中取用户
    const user = (req as Request & { user?: { sub: number } }).user
    if (user) {
      await this.authService.logout(user.sub)
    }
    return { message: '已退出登录' }
  }

  private setRefreshCookie(res: Response, token: string): void {
    const maxAge = this.configService.get<number>('jwt.refreshExpiresIn')! * 1000
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge,
    })
  }
}
