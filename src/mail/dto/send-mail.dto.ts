import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator'

export class SendMailDto {
  @IsNotEmpty({ message: '收件人不能为空' })
  @IsEmail({}, { message: '收件人邮箱格式不正确' })
  to!: string

  @IsNotEmpty({ message: '邮件主题不能为空' })
  @MaxLength(200, { message: '邮件主题不能超过200个字符' })
  subject!: string

  @IsNotEmpty({ message: '邮件正文不能为空' })
  @MaxLength(10000, { message: '邮件正文不能超过10000个字符' })
  text!: string
}
