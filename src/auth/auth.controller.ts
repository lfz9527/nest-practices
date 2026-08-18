import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { Public } from './public.decorator'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ip = req.ip ?? req.socket.remoteAddress ?? ''
    return this.authService.login(loginDto, ip)
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
}
