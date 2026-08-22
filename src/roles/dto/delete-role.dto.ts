import { IsInt, IsNotEmpty } from 'class-validator'

export class DeleteRoleDto {
  @IsNotEmpty({ message: '角色 id 不能为空' })
  @IsInt({ message: '角色 id 必须是数字' })
  id!: number
}
