import { BadRequestException } from '@nestjs/common'
import type { Response } from 'express'
import type { PinoLogger } from 'nestjs-pino'
import { AppError, ErrorCodes } from './app-error'
import { ErrorHandler } from './error-handler'

describe('ErrorHandler', () => {
  let handler: ErrorHandler
  let logger: { error: jest.Mock; fatal: jest.Mock }
  let shutdown: jest.Mock
  let response: { status: jest.Mock; json: jest.Mock }

  beforeEach(() => {
    logger = { error: jest.fn(), fatal: jest.fn() }
    shutdown = jest.fn().mockResolvedValue(undefined)
    response = { status: jest.fn(), json: jest.fn() }
    response.status.mockReturnValue(response)
    handler = new ErrorHandler(logger as unknown as PinoLogger)
    handler.registerShutdown(shutdown)
  })

  it('operational AppError：error 级日志、按注册码响应、不触发退出', () => {
    const error = new AppError(ErrorCodes.USER_NOT_FOUND, '用户 999 不存在')

    handler.handleError(error, response as unknown as Response)

    expect(logger.error).toHaveBeenCalled()
    expect(logger.fatal).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(404)
    expect(response.json).toHaveBeenCalledWith({
      code: 40401,
      message: '用户 999 不存在',
      data: null,
    })
    expect(shutdown).not.toHaveBeenCalled()
  })

  it('未约定码的 AppError：响应 code -1 与 HTTP 400', () => {
    handler.handleError(
      new AppError('库存不足'),
      response as unknown as Response,
    )

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.json).toHaveBeenCalledWith({
      code: -1,
      message: '库存不足',
      data: null,
    })
  })

  it('框架 HttpException：状态码×100 推导业务码，数组 message 合并', () => {
    const error = new BadRequestException(['a 必填', 'b 必须为数字'])

    handler.handleError(error, response as unknown as Response)

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.json).toHaveBeenCalledWith({
      code: 40000,
      message: 'a 必填; b 必须为数字',
      data: null,
    })
    expect(shutdown).not.toHaveBeenCalled()
  })

  it('裸 Error 有响应流：fatal 日志、响应 50000、进程继续（规格 D3）', () => {
    handler.handleError(new Error('boom'), response as unknown as Response)

    expect(logger.fatal).toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(500)
    expect(response.json).toHaveBeenCalledWith({
      code: 50000,
      message: '服务器内部错误',
      data: null,
    })
    expect(shutdown).not.toHaveBeenCalled()
  })

  it('裸 Error 无响应流（进程级游离错误）：fatal 日志并触发优雅退出', () => {
    handler.handleError(new Error('boom'))

    expect(logger.fatal).toHaveBeenCalled()
    expect(shutdown).toHaveBeenCalled()
  })

  it('isTrustedError 三态判定', () => {
    expect(handler.isTrustedError(new AppError('业务失败'))).toBe(true)
    expect(
      handler.isTrustedError(new AppError(ErrorCodes.UNKNOWN, '危', false)),
    ).toBe(false)
    expect(handler.isTrustedError(new Error('boom'))).toBe(false)
  })
})
