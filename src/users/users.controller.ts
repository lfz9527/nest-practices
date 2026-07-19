import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'
import { UsersService } from './users.service'
import { User } from './user.entity'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number): Promise<User | null> {
    return this.usersService.findById(id)
  }
}
