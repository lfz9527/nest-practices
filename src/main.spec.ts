import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('bootstrap shutdown hooks', () => {
  it('registers SIGTERM and SIGINT before listening', () => {
    const source = readFileSync(resolve(__dirname, 'main.ts'), 'utf8')

    expect(source.indexOf("app.enableShutdownHooks(['SIGTERM', 'SIGINT'])")).toBeGreaterThan(-1)
    expect(source.indexOf("app.enableShutdownHooks(['SIGTERM', 'SIGINT'])")).toBeLessThan(
      source.indexOf('await app.listen(port)'),
    )
  })
})
