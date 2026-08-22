import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common'
import { CreateRoleDto } from './dto/create-role.dto'
import { DeleteRoleDto } from './dto/delete-role.dto'
import { QueryRolesDto } from './dto/query-roles.dto'
import { UpdateRoleDto } from './dto/update-role.dto'
import { RolesService } from './roles.service'

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@Query() query: QueryRolesDto) {
    return this.rolesService.findAll(query)
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findById(id)
  }

  @Post()
  @HttpCode(200)
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto)
  }

  @Post('update')
  @HttpCode(200)
  update(@Body() dto: UpdateRoleDto) {
    return this.rolesService.update(dto)
  }

  @Post('delete')
  @HttpCode(200)
  remove(@Body() dto: DeleteRoleDto) {
    return this.rolesService.remove(dto.id)
  }
}
