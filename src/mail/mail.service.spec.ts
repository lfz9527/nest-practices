import { ConfigService } from '@nestjs/config'
import nodemailer from 'nodemailer'
import { MailService } from './mail.service'

// mock 整个 nodemailer 模块：createTransport 返回 { sendMail: jest.fn() }
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({ sendMail: jest.fn() }),
}))

// mockReturnValue 缓存同一实例，此处拿到的 sendMail 与 MailService 内部一致
const createTransportMock = nodemailer.createTransport as jest.Mock
const sendMail = (createTransportMock() as { sendMail: jest.Mock }).sendMail

const configMock = {
  get: (key: string) =>
    ({
      'mail.smtp.host': 'smtp.example.com',
      'mail.smtp.port': 465,
      'mail.smtp.secure': true,
      'mail.smtp.user': 'sender@example.com',
      'mail.smtp.pass': 'secret',
      'mail.smtp.from': 'sender@example.com',
    })[key],
} as unknown as ConfigService

describe('MailService', () => {
  let service: MailService

  beforeEach(() => {
    service = new MailService(configMock)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('发送成功时传递 from、to、subject 和 text', async () => {
    await service.sendTextMail({
      to: 'receiver@example.com',
      subject: '测试邮件',
      text: '邮件正文',
    })
    expect(sendMail).toHaveBeenCalledWith({
      from: 'sender@example.com',
      to: 'receiver@example.com',
      subject: '测试邮件',
      text: '邮件正文',
    })
  })

  it('SMTP 发送失败时抛出不泄露底层信息的 AppError', async () => {
    sendMail.mockRejectedValue(new Error('password leaked'))
    await expect(
      service.sendTextMail({
        to: 'receiver@example.com',
        subject: '测试邮件',
        text: '邮件正文',
      }),
    ).rejects.toMatchObject({
      message: '邮件发送失败',
    })
    await expect(
      service.sendTextMail({
        to: 'receiver@example.com',
        subject: '测试邮件',
        text: '邮件正文',
      }),
    ).rejects.not.toMatchObject({ message: 'password leaked' })
  })

  it('SMTP 配置缺失时抛 AppError 邮件服务未配置', () => {
    const missingConfigMock = {
      get: () => undefined,
    } as unknown as ConfigService
    expect(() => new MailService(missingConfigMock)).toThrow('邮件服务未配置')
  })
})
