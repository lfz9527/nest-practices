import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { JwtService } from '@nestjs/jwt'
import { AuthService } from './auth.service'
import { User } from '../users/user.entity'
import { AppError } from '../common/errors/app-error'

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

import * as bcryptjs from 'bcryptjs'
const mockedBcrypt = bcryptjs as jest.Mocked<typeof bcryptjs>

describe('AuthService', () => {
  let service: AuthService
  const mockUserRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  }
  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: '123456' }
    const mockUser: User = {
      id: 1,
      email: 'test@example.com',
      password: 'hashed-password',
      nickname: 'test',
      status: 0,
      delFlag: 0,
      gender: 2,
      avatar: '',
      lastLoginIp: '',
      lastLoginTime: null,
      remark: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('应成功登录并返回 access_token 和用户信息', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser)
      mockedBcrypt.compare.mockResolvedValue(true as never)

      const result = await service.login(loginDto, '127.0.0.1')

      expect(result.access_token).toBe('mock-token')
      expect(result.user).toBeDefined()
      expect(result.user?.id).toBe(1)
      expect(result.user?.email).toBe('test@example.com')
      expect(result.user).not.toHaveProperty('password')
      expect(mockUserRepo.update).toHaveBeenCalledWith(1, {
        lastLoginIp: '127.0.0.1',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        lastLoginTime: expect.any(Date),
      })
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        email: 'test@example.com',
      })
    })

    it('用户不存在应抛 AppError', async () => {
      mockUserRepo.findOne.mockResolvedValue(null)

      await expect(service.login(loginDto, '')).rejects.toThrow(AppError)
      await expect(service.login(loginDto, '')).rejects.toThrow(
        '账号或密码错误',
      )
    })

    it('账号已停用应抛 AppError', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser, status: 1 })

      await expect(service.login(loginDto, '')).rejects.toThrow(AppError)
      await expect(service.login(loginDto, '')).rejects.toThrow('账号已被停用')
    })

    it('密码错误应抛 AppError', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser)
      mockedBcrypt.compare.mockResolvedValue(false as never)

      await expect(service.login(loginDto, '')).rejects.toThrow(AppError)
      await expect(service.login(loginDto, '')).rejects.toThrow(
        '账号或密码错误',
      )
    })
  })

  describe('register', () => {
    const registerDto = {
      nickname: 'newuser',
      email: 'new@example.com',
      password: '123456',
    }
    const savedUser = { id: 2, nickname: 'newuser', email: 'new@example.com' }

    it('应成功注册并返回用户信息', async () => {
      mockUserRepo.findOne.mockResolvedValue(null)
      mockUserRepo.create.mockReturnValue(savedUser)
      mockUserRepo.save.mockResolvedValue(savedUser)

      const result = await service.register(registerDto)

      expect(result).toEqual({
        id: 2,
        nickname: 'newuser',
        email: 'new@example.com',
      })
      expect(mockUserRepo.create).toHaveBeenCalled()
      expect(mockUserRepo.save).toHaveBeenCalled()
    })

    it('邮箱已注册应抛 AppError', async () => {
      mockUserRepo.findOne.mockResolvedValue(savedUser)

      await expect(service.register(registerDto)).rejects.toThrow(AppError)
      await expect(service.register(registerDto)).rejects.toThrow(
        '该邮箱已注册',
      )
    })
  })
})
