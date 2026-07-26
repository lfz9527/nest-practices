import { Injectable, NestMiddleware } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'

// 扩展 Express Request，挂载 requestId（不使用 declare module 全局扩展，避免污染）
export interface RequestWithId extends Request {
  requestId: string
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: () => void): void {
    const reqId =
      (req.headers['x-request-id'] as string | undefined) || randomUUID()

    req.requestId = reqId
    res.setHeader('x-request-id', reqId)

    next()
  }
}
