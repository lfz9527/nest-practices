import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AppError, ErrorCodes } from '../common/errors/app-error'
import { User } from './user.entity'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findById(id: number): Promise<User> {
    const user: User | null = await this.userRepo.findOne({
      where: { id, delFlag: 0 },
    })
    if (!user) {
      throw new AppError(ErrorCodes.USER_NOT_FOUND, `用户 ${id} 不存在`)
    }
    return user
  }
}
