import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Length,
  MaxLength,
} from 'class-validator'

export class UpdateRoleDto {
  @IsNotEmpty({ message: '角色 id 不能为空' })
  @IsInt({ message: '角色 id 必须是数字' })
  id!: number

  @IsNotEmpty({ message: '角色名称不能为空' })
  @Length(1, 30, { message: '角色名称长度需在 1-30 之间' })
  name!: string

  @IsOptional()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number

  @IsOptional()
  @IsInt({ message: '排序必须是整数' })
  sort?: number

  @IsOptional()
  @MaxLength(255, { message: '备注不能超过 255 字符' })
  remark?: string
}
