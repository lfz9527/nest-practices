import {
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MaxLength,
  MinLength,
  IsIn,
} from 'class-validator'

export class CreateUserDto {
  @IsNotEmpty({ message: '昵称不能为空' })
  @MaxLength(30, { message: '昵称最长30个字符' })
  nickname!: string

  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(100, { message: '邮箱最长100个字符' })
  email!: string

  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码最少6个字符' })
  @MaxLength(255, { message: '密码最长255个字符' })
  password!: string

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
