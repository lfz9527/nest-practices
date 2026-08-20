import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport } from 'nodemailer'
import { AppError } from '../common/errors/app-error'
import { SendMailDto } from './dto/send-mail.dto'

@Injectable()
export class MailService {
  constructor(private readonly configService: ConfigService) {}

  // 延迟初始化：不在构造阶段读取配置，避免 SMTP 未配置时拖垮应用启动
  async sendTextMail(dto: SendMailDto): Promise<{ message: string }> {
    const host = this.configService.get<string>('mail.smtp.host')
    const port = this.configService.get<string | number>('mail.smtp.port')
    const secure = this.configService.get<boolean>('mail.smtp.secure')
    const user = this.configService.get<string>('mail.smtp.user')
    const pass = this.configService.get<string>('mail.smtp.pass')
    const from = this.configService.get<string>('mail.smtp.from')
    if (
      !host ||
      !user ||
      !pass ||
      !from ||
      port == null ||
      port === '' ||
      Number.isNaN(Number(port))
    ) {
      throw new AppError('邮件服务未配置')
    }
    const transporter = createTransport({
      host,
      port: Number(port),
      secure,
      auth: { user, pass },
      from,
    })
    try {
      await transporter.sendMail({
        from,
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
