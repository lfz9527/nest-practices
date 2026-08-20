import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport, type Transporter } from 'nodemailer'
import { AppError } from '../common/errors/app-error'
import { SendMailDto } from './dto/send-mail.dto'

@Injectable()
export class MailService {
  private readonly transporter: Transporter
  private readonly from: string

  constructor(configService: ConfigService) {
    const host = configService.get<string>('mail.smtp.host')
    const port = configService.get<number>('mail.smtp.port')
    const secure = configService.get<boolean>('mail.smtp.secure')
    const user = configService.get<string>('mail.smtp.user')
    const pass = configService.get<string>('mail.smtp.pass')
    const from = configService.get<string>('mail.smtp.from')
    if (
      !host ||
      !user ||
      !pass ||
      !from ||
      port == null ||
      Number.isNaN(port)
    ) {
      throw new AppError('邮件服务未配置')
    }
    this.from = from
    this.transporter = createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      from,
    })
  }

  async sendTextMail(dto: SendMailDto): Promise<{ message: string }> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: dto.to,
        subject: dto.subject,
        text: dto.text,
      })
      return { message: '邮件发送成功' }
    } catch {
      // 不向调用方泄露底层 SMTP 错误信息
      throw new AppError('邮件发送失败')
    }
  }
}
