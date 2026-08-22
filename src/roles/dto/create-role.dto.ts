import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Length,
  MaxLength,
} from 'class-validator'

export class CreateRoleDto {
  @IsNotEmpty({ message: '角色名称不能为空' })
  @Length(1, 30, { message: '角色名称长度需在 1-30 之间' })
  name!: string

  @IsNotEmpty({ message: '角色编码不能为空' })
  @Length(1, 50, { message: '角色编码长度需在 1-50 之间' })
  roleKey!: string

  @IsOptional()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status = 0

  @IsOptional()
  @IsInt({ message: '排序必须是整数' })
  sort = 0

  @IsOptional()
  @MaxLength(255, { message: '备注不能超过 255 字符' })
  remark = ''
}
