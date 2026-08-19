import type { INestApplication } from '@nestjs/common'
import type { Logger } from 'nestjs-pino'
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
})
