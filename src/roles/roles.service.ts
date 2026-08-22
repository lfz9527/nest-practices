import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { User } from '../users/user.entity'
import { CreateRoleDto } from './dto/create-role.dto'
import { QueryRolesDto } from './dto/query-roles.dto'
import { UpdateRoleDto } from './dto/update-role.dto'
import { Role } from './role.entity'

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(
    query: QueryRolesDto,
  ): Promise<{ list: Role[]; total: number }> {
    const [list, total] = await this.roleRepo.findAndCount({
      where: {
        delFlag: 0,
        ...(query.name ? { name: Like(`%${query.name}%`) } : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
      },
      order: { sort: 'ASC', id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    })
    return { list, total }
  }

  async findById(id: number): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id, delFlag: 0 } })
    if (!role) {
      throw new AppError(ErrorCodes.BIZ_ERROR, `角色 ${id} 不存在`)
    }
    return role
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    await this.assertRoleKeyUnique(dto.roleKey)
    return this.roleRepo.save(this.roleRepo.create(dto))
  }

  async update(dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findById(dto.id)
    await this.roleRepo.update(dto.id, {
      name: dto.name,
      status: dto.status ?? role.status,
      sort: dto.sort ?? role.sort,
      remark: dto.remark ?? role.remark,
    })
    return this.findById(dto.id)
  }

  async remove(id: number): Promise<void> {
    await this.findById(id)
    await this.roleRepo.update(id, { delFlag: 2 })
    await this.userRepo.update({ roleId: id }, { roleId: null })
  }

  // roleKey 唯一（含软删除数据），保证 (roleKey, delFlag) 唯一约束不冲突
  private async assertRoleKeyUnique(roleKey: string): Promise<void> {
    const exists = await this.roleRepo.findOne({ where: { roleKey } })
    if (exists) {
      throw new AppError(ErrorCodes.BIZ_ERROR, `角色编码 ${roleKey} 已存在`)
    }
  }
}
