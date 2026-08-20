import { ConfigService } from '@nestjs/config'
import nodemailer from 'nodemailer'
import { MailService } from './mail.service'

// mock 整个 nodemailer 模块：每次 createTransport 调用返回新的 { sendMail: jest.fn() }
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: jest.fn(),
  })),
}))

const createTransportMock = nodemailer.createTransport as jest.Mock

const validConfigMock = {
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

const missingConfigMock = {
  get: () => undefined,
} as unknown as ConfigService

const sendMailDto = {
  to: 'receiver@example.com',
  subject: '测试邮件',
  text: '邮件正文',
}

describe('MailService', () => {
  let service: MailService

  beforeEach(() => {
    // afterEach 的 resetAllMocks 会清掉工厂里挂载的默认实现，这里重新挂载
    createTransportMock.mockImplementation(() => ({
      sendMail: jest.fn(),
    }))
    service = new MailService(validConfigMock)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('发送成功时按配置创建 transporter 并传递 from、to、subject 和 text', async () => {
    await service.sendTextMail(sendMailDto)
    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'sender@example.com', pass: 'secret' },
      from: 'sender@example.com',
    })
    const { sendMail } = createTransportMock.mock.results[0].value as {
      sendMail: jest.Mock
    }
    expect(sendMail).toHaveBeenCalledWith({
      from: 'sender@example.com',
      to: 'receiver@example.com',
      subject: '测试邮件',
      text: '邮件正文',
    })
  })

  it('SMTP 发送失败时抛出不泄露底层信息的 AppError', async () => {
    createTransportMock.mockImplementation(() => ({
      sendMail: jest.fn().mockRejectedValue(new Error('password leaked')),
    }))
    await expect(service.sendTextMail(sendMailDto)).rejects.toMatchObject({
      message: '邮件发送失败',
    })
    await expect(service.sendTextMail(sendMailDto)).rejects.not.toMatchObject({
      message: 'password leaked',
    })
  })

  it('SMTP 配置缺失时发送邮件抛出 AppError 邮件服务未配置', async () => {
    const serviceWithMissingConfig = new MailService(missingConfigMock)
    await expect(
      serviceWithMissingConfig.sendTextMail(sendMailDto),
    ).rejects.toMatchObject({
      message: '邮件服务未配置',
    })
  })

  it('SMTP 密码为空字符串时发送邮件抛出 AppError 邮件服务未配置', async () => {
    const emptyPassConfigMock = {
      get: (key: string) =>
        ({
          'mail.smtp.host': 'smtp.example.com',
          'mail.smtp.port': 465,
          'mail.smtp.user': 'sender@example.com',
          'mail.smtp.pass': '',
          'mail.smtp.from': 'sender@example.com',
        })[key],
    } as unknown as ConfigService
    const serviceWithEmptyPass = new MailService(emptyPassConfigMock)
    await expect(
      serviceWithEmptyPass.sendTextMail(sendMailDto),
    ).rejects.toMatchObject({
      message: '邮件服务未配置',
    })
  })
})
