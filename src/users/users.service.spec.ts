import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AppError, ErrorCodes } from '../errors/app-error'
import { User } from './user.entity'
import { UsersService } from './users.service'

describe('UsersService', () => {
  let service: UsersService
  const userRepo = { findOne: jest.fn() }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile()
    service = moduleRef.get(UsersService)
  })

  it('用户不存在时抛出 USER_NOT_FOUND 的 AppError', async () => {
    userRepo.findOne.mockResolvedValue(null)

    const promise = service.findById(999)

    await expect(promise).rejects.toBeInstanceOf(AppError)
    await expect(promise).rejects.toMatchObject({
      code: ErrorCodes.USER_NOT_FOUND.code,
      httpCode: 404,
      isOperational: true,
      message: '用户 999 不存在',
    })
  })
})
