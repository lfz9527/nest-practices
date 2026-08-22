import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AppError } from '../common/errors/app-error'
import { User } from '../users/user.entity'
import { Role } from './role.entity'
import { RolesService } from './roles.service'

describe('RolesService', () => {
  let service: RolesService
  const roleRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  }
  const userRepo = { update: jest.fn() }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile()
    service = moduleRef.get(RolesService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const mockRole = (overrides: Partial<Role> = {}): Role =>
    ({
      id: 1,
      name: '管理员',
      roleKey: 'admin',
      status: 0,
      sort: 0,
      remark: '',
      delFlag: 0,
      ...overrides,
    }) as Role

  it('findAll：按分页与筛选条件查询', async () => {
    roleRepo.findAndCount.mockResolvedValue([[mockRole()], 1])

    const result = await service.findAll({
      page: 2,
      pageSize: 20,
      name: '管',
      status: 0,
    })

    expect(result).toEqual({ list: [mockRole()], total: 1 })
    expect(roleRepo.findAndCount).toHaveBeenCalledWith({
      where: {
        delFlag: 0,
        name: expect.any(Object) as object,
        status: 0,
      },
      order: { sort: 'ASC', id: 'DESC' },
      skip: 20,
      take: 20,
    })
  })

  it('findAll：无筛选条件时不传 name/status', async () => {
    roleRepo.findAndCount.mockResolvedValue([[], 0])

    await service.findAll({ page: 1, pageSize: 10 })

    expect(roleRepo.findAndCount).toHaveBeenCalledWith({
      where: { delFlag: 0 },
      order: { sort: 'ASC', id: 'DESC' },
      skip: 0,
      take: 10,
    })
  })

  it('findById：存在时返回角色', async () => {
    roleRepo.findOne.mockResolvedValue(mockRole())

    const result = await service.findById(1)

    expect(result).toEqual(mockRole())
    expect(roleRepo.findOne).toHaveBeenCalledWith({
      where: { id: 1, delFlag: 0 },
    })
  })

  it('findById：角色不存在时抛 code -1 的 AppError', async () => {
    roleRepo.findOne.mockResolvedValue(null)

    const promise = service.findById(999)

    await expect(promise).rejects.toBeInstanceOf(AppError)
    await expect(promise).rejects.toMatchObject({
      code: -1,
      message: '角色 999 不存在',
    })
  })

  it('create：保存成功', async () => {
    const dto = {
      name: '测试角色',
      roleKey: 'test',
      status: 0,
      sort: 0,
      remark: '',
    }
    roleRepo.findOne.mockResolvedValue(null)
    roleRepo.create.mockReturnValue(dto)
    roleRepo.save.mockResolvedValue(mockRole(dto))

    const result = await service.create(dto)

    expect(result).toEqual(mockRole(dto))
    expect(roleRepo.create).toHaveBeenCalledWith(dto)
    expect(roleRepo.save).toHaveBeenCalledWith(dto)
  })

  it('create：roleKey 已存在（含软删除）时抛错', async () => {
    roleRepo.findOne.mockResolvedValue(mockRole({ delFlag: 2 }))

    const promise = service.create({
      name: '测试角色',
      roleKey: 'test',
      status: 0,
      sort: 0,
      remark: '',
    })

    await expect(promise).rejects.toMatchObject({
      code: -1,
      message: '角色编码 test 已存在',
    })
    expect(roleRepo.create).not.toHaveBeenCalled()
  })

  it('update：更新成功并返回最新数据', async () => {
    roleRepo.findOne
      .mockResolvedValueOnce(mockRole())
      .mockResolvedValueOnce(mockRole({ name: '新名称' }))
    roleRepo.update.mockResolvedValue({ affected: 1 })

    const result = await service.update({
      id: 1,
      name: '新名称',
      status: 1,
      sort: 5,
      remark: '备注',
    })

    expect(roleRepo.update).toHaveBeenCalledWith(1, {
      name: '新名称',
      status: 1,
      sort: 5,
      remark: '备注',
    })
    expect(result.name).toBe('新名称')
  })

  it('update：字段缺省时保留原值', async () => {
    roleRepo.findOne
      .mockResolvedValueOnce(mockRole({ status: 1, sort: 5, remark: '旧备注' }))
      .mockResolvedValueOnce(mockRole())
    roleRepo.update.mockResolvedValue({ affected: 1 })

    await service.update({ id: 1, name: '仅改名' })

    expect(roleRepo.update).toHaveBeenCalledWith(1, {
      name: '仅改名',
      status: 1,
      sort: 5,
      remark: '旧备注',
    })
  })

  it('update：角色不存在时抛错', async () => {
    roleRepo.findOne.mockResolvedValue(null)

    await expect(service.update({ id: 999, name: 'x' })).rejects.toMatchObject({
      code: -1,
      message: '角色 999 不存在',
    })
  })

  it('remove：软删除并置空关联用户 roleId', async () => {
    roleRepo.findOne.mockResolvedValue(mockRole())
    roleRepo.update.mockResolvedValue({ affected: 1 })
    userRepo.update.mockResolvedValue({ affected: 1 })

    await service.remove(1)

    expect(roleRepo.update).toHaveBeenCalledWith(1, { delFlag: 2 })
    expect(userRepo.update).toHaveBeenCalledWith(
      { roleId: 1 },
      { roleId: null },
    )
  })

  it('remove：角色不存在时抛错', async () => {
    roleRepo.findOne.mockResolvedValue(null)

    await expect(service.remove(999)).rejects.toMatchObject({
      code: -1,
      message: '角色 999 不存在',
    })
    expect(userRepo.update).not.toHaveBeenCalled()
  })
})
