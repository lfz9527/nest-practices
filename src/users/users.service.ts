import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
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
      throw new NotFoundException(`用户 ${id} 不存在`)
    }
    return user
  }
}
