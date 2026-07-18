import {
  IsOptional,
  IsEmail,
  MaxLength,
  MinLength,
  IsIn,
} from 'class-validator'

export class UpdateUserDto {
  @IsOptional()
  @MaxLength(30, { message: '昵称最长30个字符' })
  nickname?: string

  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(100, { message: '邮箱最长100个字符' })
  email?: string

  @IsOptional()
  @MinLength(6, { message: '密码最少6个字符' })
  @MaxLength(255, { message: '密码最长255个字符' })
  password?: string

  @IsOptional()
  @IsIn([0, 1, 2], { message: '性别: 0=男 1=女 2=未知' })
  gender?: number

  @IsOptional()
  @MaxLength(255, { message: '头像路径最长255个字符' })
  avatar?: string

  @IsOptional()
  @MaxLength(255, { message: '备注最长255个字符' })
  remark?: string
}
