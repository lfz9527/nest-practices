import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtService } from '@nestjs/jwt'
import { hash, compare } from 'bcryptjs'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { User } from '../users/user.entity'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'

const SALT_ROUNDS = 10

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    loginDto: LoginDto,
    ip: string,
  ): Promise<{ access_token: string; user: Omit<User, 'password'> }> {
    const user = await this.userRepo.findOne({
      where: { email: loginDto.email, delFlag: 0 },
    })
    if (!user) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '账号或密码错误')
    }
    if (user.status === 1) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '账号已被停用')
    }

    const isPasswordValid = await compare(loginDto.password, user.password)
    if (!isPasswordValid) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '账号或密码错误')
    }

    // 更新登录信息
    await this.userRepo.update(user.id, {
      lastLoginIp: ip,
      lastLoginTime: new Date(),
    })

    const access_token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      ver: user.tokenVersion as number,
    })

    const { password: _, ...userWithoutPassword } = user
    void _
    return { access_token, user: userWithoutPassword }
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<{ id: number; nickname: string; email: string }> {
    const existing = await this.userRepo.findOne({
      where: { email: registerDto.email, delFlag: 0 },
    })
    if (existing) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '该邮箱已注册')
    }

    const hashedPassword = await hash(registerDto.password, SALT_ROUNDS)

    const user = this.userRepo.create({
      nickname: registerDto.nickname,
      email: registerDto.email,
      password: hashedPassword,
    })

    const saved = await this.userRepo.save(user)

    return {
      id: saved.id,
      nickname: saved.nickname,
      email: saved.email,
    }
  }
}
