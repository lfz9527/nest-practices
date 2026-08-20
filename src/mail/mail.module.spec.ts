import { Test } from '@nestjs/testing'
import { MailModule } from './mail.module'
import { MailService } from './mail.service'

describe('MailModule', () => {
  it('模块可正常初始化且 MailService 可获取', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MailModule],
    }).compile()
    expect(moduleRef.get(MailService)).toBeDefined()
  })
})
