import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { SendMailDto } from './dto/send-mail.dto'
import { MailService } from './mail.service'

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send')
  @HttpCode(200)
  send(@Body() dto: SendMailDto) {
    return this.mailService.sendTextMail(dto)
  }
}
