import { readFileSync } from 'fs'
import { load } from 'js-yaml'
import { resolve } from 'path'

export default () => {
  const env = process.env.NODE_ENV ?? 'dev'
  return load(readFileSync(resolve(`config.${env}.yaml`), 'utf8')) as Record<
    string,
    unknown
  >
}
