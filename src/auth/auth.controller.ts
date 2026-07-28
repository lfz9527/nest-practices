import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  ValidationPipe,
} from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import type { Request } from 'express'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login_email')
  @HttpCode(200)
  async login(
    @Body(ValidationPipe) loginDto: LoginDto,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? ''
    return this.authService.login(loginDto, ip)
  }

  @Post('register')
  @HttpCode(200)
  async register(
    @Body(ValidationPipe) registerDto: RegisterDto,
  ) {
    return this.authService.register(registerDto)
  }
}
