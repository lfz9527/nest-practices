import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { Role, RoleInfo } from '../roles/role.entity'
import { User } from './user.entity'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async findById(id: number): Promise<User & { role: RoleInfo | null }> {
    const user: User | null = await this.userRepo.findOne({
      where: { id, delFlag: 0 },
    })
    if (!user) {
      throw new AppError(ErrorCodes.BIZ_ERROR, `用户 ${id} 不存在`)
    }
    return { ...user, role: await this.findRole(user.roleId) }
  }

  // 查询用户角色简要信息，无角色或角色已删除返回 null
  private async findRole(roleId: number | null): Promise<RoleInfo | null> {
    if (!roleId) {
      return null
    }
    const role = await this.roleRepo.findOne({
      where: { id: roleId, delFlag: 0 },
    })
    if (!role) {
      return null
    }
    return { id: role.id, name: role.name, roleKey: role.roleKey }
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { email, delFlag: 0 },
    })
    if (!user) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '用户不存在')
    }
    return user
  }
}
