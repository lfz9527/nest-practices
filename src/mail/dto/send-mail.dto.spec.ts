import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { SendMailDto } from './send-mail.dto'

const validateDto = (data: Record<string, unknown>) =>
  validate(plainToInstance(SendMailDto, data))

const validData = () => ({
  to: 'receiver@example.com',
  subject: '测试邮件主题',
  text: '测试邮件正文',
})

describe('SendMailDto', () => {
  it('缺少 to 时校验失败', async () => {
    const errors = await validateDto({
      subject: '测试邮件主题',
      text: '测试邮件正文',
    })
    expect(errors).toHaveLength(1)
    expect(errors[0].property).toBe('to')
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      '收件人不能为空',
    )
  })

  it('缺少 subject 时校验失败', async () => {
    const errors = await validateDto({
      to: 'receiver@example.com',
      text: '测试邮件正文',
    })
    expect(errors).toHaveLength(1)
    expect(errors[0].property).toBe('subject')
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      '邮件主题不能为空',
    )
  })

  it('缺少 text 时校验失败', async () => {
    const errors = await validateDto({
      to: 'receiver@example.com',
      subject: '测试邮件主题',
    })
    expect(errors).toHaveLength(1)
    expect(errors[0].property).toBe('text')
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      '邮件正文不能为空',
    )
  })

  it('to 格式非法时校验失败', async () => {
    const errors = await validateDto({ ...validData(), to: 'not-an-email' })
    expect(errors).toHaveLength(1)
    expect(errors[0].property).toBe('to')
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      '收件人邮箱格式不正确',
    )
  })

  it('subject 超过 200 字符时校验失败', async () => {
    const errors = await validateDto({
      ...validData(),
      subject: 'a'.repeat(201),
    })
    expect(errors).toHaveLength(1)
    expect(errors[0].property).toBe('subject')
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      '邮件主题不能超过200个字符',
    )
  })

  it('subject 恰为 200 字符时校验通过', async () => {
    const errors = await validateDto({
      ...validData(),
      subject: 'a'.repeat(200),
    })
    expect(errors).toHaveLength(0)
  })

  it('text 超过 10000 字符时校验失败', async () => {
    const errors = await validateDto({
      ...validData(),
      text: 'a'.repeat(10001),
    })
    expect(errors).toHaveLength(1)
    expect(errors[0].property).toBe('text')
    expect(Object.values(errors[0].constraints ?? {})).toContain(
      '邮件正文不能超过10000个字符',
    )
  })

  it('text 恰为 10000 字符时校验通过', async () => {
    const errors = await validateDto({
      ...validData(),
      text: 'a'.repeat(10000),
    })
    expect(errors).toHaveLength(0)
  })

  it('完整合法 DTO 校验通过', async () => {
    const errors = await validateDto(validData())
    expect(errors).toHaveLength(0)
  })
})
