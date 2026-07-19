import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AppError } from '../common/errors/app-error'
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

  it('用户不存在时抛出 code -1 的 AppError', async () => {
    userRepo.findOne.mockResolvedValue(null)

    const promise = service.findById(999)

    await expect(promise).rejects.toBeInstanceOf(AppError)
    await expect(promise).rejects.toMatchObject({
      code: -1,
      isOperational: true,
      message: '用户 999 不存在',
    })
  })
})
