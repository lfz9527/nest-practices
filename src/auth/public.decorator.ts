import { SetMetadata } from '@nestjs/common'
import { IS_PUBLIC_KEY } from './auth.guard'

// 标记接口无需登录（全局守卫放行）
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
