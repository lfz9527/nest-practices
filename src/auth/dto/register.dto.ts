import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator'

export class RegisterDto {
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
}
