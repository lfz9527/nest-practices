import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AppError } from '../common/errors/app-error'
import { Role } from '../roles/role.entity'
import { User } from './user.entity'
import { UsersService } from './users.service'

describe('UsersService', () => {
  let service: UsersService
  const userRepo = { findOne: jest.fn() }
  const roleRepo = { findOne: jest.fn() }

  beforeEach(async () => {
    jest.clearAllMocks()
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
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

  describe('findByEmail', () => {
    it('应通过邮箱查询用户', async () => {
      const mockUser = { id: 1, email: 'test@example.com' }
      userRepo.findOne.mockResolvedValue(mockUser)

      const result = await service.findByEmail('test@example.com')
      expect(result).toEqual(mockUser)
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com', delFlag: 0 },
      })
    })

    it('邮箱不存在应抛 AppError', async () => {
      userRepo.findOne.mockResolvedValue(null)

      await expect(service.findByEmail('no@exists.com')).rejects.toThrow(
        AppError,
      )
    })
  })

  describe('findById 返回角色', () => {
    it('用户带 roleId 时返回 { id, name, roleKey }', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, roleId: 5, delFlag: 0 })
      roleRepo.findOne.mockResolvedValue({
        id: 5,
        name: '管理员',
        roleKey: 'admin',
      })

      const result = await service.findById(1)

      expect(result).toMatchObject({
        id: 1,
        role: { id: 5, name: '管理员', roleKey: 'admin' },
      })
      expect(roleRepo.findOne).toHaveBeenCalledWith({
        where: { id: 5, delFlag: 0 },
      })
    })

    it('roleId 为空时不查询角色，role 为 null', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, roleId: null, delFlag: 0 })

      const result = await service.findById(1)

      expect(result.role).toBeNull()
      expect(roleRepo.findOne).not.toHaveBeenCalled()
    })

    it('角色已被删除时 role 为 null', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, roleId: 5, delFlag: 0 })
      roleRepo.findOne.mockResolvedValue(null)

      const result = await service.findById(1)

      expect(result.role).toBeNull()
    })
  })
})
