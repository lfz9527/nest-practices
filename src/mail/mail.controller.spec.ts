import { Test } from '@nestjs/testing'
import { MailController } from './mail.controller'
import { MailService } from './mail.service'

const mailServiceMock = {
  sendTextMail: jest.fn(),
}

describe('MailController', () => {
  let controller: MailController

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MailController],
      providers: [{ provide: MailService, useValue: mailServiceMock }],
    }).compile()
    controller = moduleRef.get(MailController)
  })

  afterEach(() => jest.clearAllMocks())

  it('发送邮件：调用 MailService 并原样返回结果', async () => {
    mailServiceMock.sendTextMail.mockResolvedValue({ message: '邮件发送成功' })
    const dto = { to: 'receiver@example.com', subject: '主题', text: '正文' }
    await expect(controller.send(dto)).resolves.toEqual({
      message: '邮件发送成功',
    })
    expect(mailServiceMock.sendTextMail).toHaveBeenCalledWith(dto)
  })
})
