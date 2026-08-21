import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import type { Response } from 'express'
import { AllExceptionsFilter } from './all-exceptions.filter'
import { AppError } from './app-error'
import type { ErrorHandler } from './error-handler'

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter
  let errorHandler: { handleError: jest.Mock; extractMessage: jest.Mock }
  let response: { status: jest.Mock; end: jest.Mock }
  let host: ArgumentsHost

  beforeEach(() => {
    errorHandler = {
      handleError: jest.fn(),
      extractMessage: jest.fn().mockReturnValue('邮箱格式不正确'),
    }
    response = { status: jest.fn().mockReturnThis(), end: jest.fn() }
    host = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/auth/login' }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost
    filter = new AllExceptionsFilter(errorHandler as unknown as ErrorHandler)
  })

  it('校验异常 400：转为 AppError(-1)，message 复用 ErrorHandler 提取口径', () => {
    const error = new BadRequestException(['邮箱格式不正确', '验证码不能为空'])
    filter.catch(error, host)
    const [appError] = errorHandler.handleError.mock.calls[0] as [AppError]
    expect(appError).toBeInstanceOf(AppError)
    expect(appError.code).toBe(-1)
    expect(appError.message).toBe('邮箱格式不正确')
    expect(errorHandler.extractMessage).toHaveBeenCalledWith(error)
  })

  it('校验异常 400（字符串 message）：同样转为 AppError(-1)', () => {
    filter.catch(new BadRequestException('参数错误'), host)
    const [appError] = errorHandler.handleError.mock.calls[0] as [AppError]
    expect(appError.code).toBe(-1)
  })

  it('非 400 异常（404）：原样交给 ErrorHandler', () => {
    const error = new NotFoundException('Cannot GET /noise')
    filter.catch(error, host)
    expect(errorHandler.handleError).toHaveBeenCalledWith(error, response)
    expect(errorHandler.extractMessage).not.toHaveBeenCalled()
  })

  it('裸 Error：原样交给 ErrorHandler', () => {
    const error = new Error('boom')
    filter.catch(error, host)
    expect(errorHandler.handleError).toHaveBeenCalledWith(error, response)
  })

  it('静默路径：直接 404，不进入 ErrorHandler', () => {
    host = {
      switchToHttp: () => ({
        getRequest: () => ({
          url: '/.well-known/appspecific/com.chrome.devtools.json',
        }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost
    filter.catch(new Error('boom'), host)
    expect(response.status).toHaveBeenCalledWith(404)
    expect(response.end).toHaveBeenCalled()
    expect(errorHandler.handleError).not.toHaveBeenCalled()
  })
})
