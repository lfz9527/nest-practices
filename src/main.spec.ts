import type { INestApplication } from '@nestjs/common'
import { Logger } from 'nestjs-pino'
import { ErrorHandler } from './common/errors/error-handler'
import { bootstrap } from './main'
import { configureApplication } from './main.setup'

describe('bootstrap application setup', () => {
  it('registers shutdown hooks before listening configuration completes', () => {
    const calls: string[] = []
    const app = {
      useLogger: jest.fn(() => calls.push('logger')),
      useGlobalPipes: jest.fn(() => calls.push('pipes')),
      enableShutdownHooks: jest.fn(() => calls.push('shutdown')),
    }

    configureApplication(app as unknown as INestApplication, {} as Logger)

    expect(app.enableShutdownHooks).toHaveBeenCalledWith(['SIGTERM', 'SIGINT'])
    expect(calls.indexOf('shutdown')).toBeLessThan(calls.length)
    expect(calls).toEqual(['logger', 'pipes', 'shutdown'])
  })

  it('实际 bootstrap 在 listen 前启用 shutdown hooks', async () => {
    const calls: string[] = []
    const logger = { log: jest.fn() }
    const errorHandler = { registerShutdown: jest.fn() }
    const config = { get: jest.fn(() => 3000) }
    const app = {
      get: jest.fn((token: unknown) => {
        if (token === Logger) return logger
        if (token === ErrorHandler) return errorHandler
        return config
      }),
      useLogger: jest.fn(),
      useGlobalPipes: jest.fn(),
      enableShutdownHooks: jest.fn(() => calls.push('shutdown')),
      listen: jest.fn(() => {
        calls.push('listen')
        return Promise.resolve()
      }),
      close: jest.fn(),
    }

    await bootstrap(jest.fn().mockResolvedValue(app) as never)

    expect(app.enableShutdownHooks).toHaveBeenCalledWith(['SIGTERM', 'SIGINT'])
    expect(calls).toEqual(['shutdown', 'listen'])
  })
})
