# 多端认证会话设计

日期：2026-08-18
状态：已确认方案 A

## 目标

将当前单端登录改为多端同时登录。每次登录由服务端生成独立 `sessionId`，不同设备拥有独立会话；登出只删除当前会话，不影响其他设备。

## 方案

采用服务端生成 `sessionId`，前端无需生成或提交设备 ID。

### Token 载荷

```json
{
  "sub": 1,
  "email": "admin@example.com",
  "sessionId": "服务端生成的 UUID",
  "jti": "当前 token 的 UUID",
  "type": "access"
}
```

- `sessionId` 标识一次登录会话。
- `jti` 标识该会话当前签发的 token，用于 Redis 比对。
- access token 有效期保持 7 天。

### Redis 键

```text
auth:session:{userId}:{sessionId} = jti
```

登录时写入对应会话 key，不覆盖同一用户的其他会话。

## 数据流

### 登录

1. 前端调用 `POST /auth/login`，只提交邮箱和密码。
2. 服务端验证账号密码。
3. 服务端生成 `sessionId` 与 `jti`。
4. 签发 access token，将 `sub/email/sessionId/jti/type` 写入载荷。
5. Redis 写入 `auth:session:{userId}:{sessionId}`，值为 jti，TTL 为 access token 有效期。
6. 返回 access token 与用户信息。

### 请求鉴权

1. 全局 `JwtAuthGuard` 提取 Bearer token。
2. `JwtStrategy` 校验签名、有效期和 `type`。
3. 根据 payload 的 `sub` 与 `sessionId` 读取 Redis 会话。
4. Redis 中的 jti 与 token jti 一致则放行，否则返回业务 `code: 401`。

### 当前会话登出

1. 前端调用 `POST /auth/logout`，携带当前 access token。
2. 守卫完成当前会话校验并注入 payload。
3. 服务端根据 `sub + sessionId` 删除当前 Redis key。
4. 当前 token 立即失效，其他 sessionId 的会话继续有效。

## 接口影响

- `POST /auth/login`：请求参数不变，响应中的 access token 增加内部会话信息，但前端无需解析 token。
- `POST /auth/logout`：请求参数不变，只退出当前会话。
- `GET /users/:id`：鉴权规则不变。
- 不新增设备 ID 请求字段。
- 不新增 refresh token 或退出所有设备接口。

## 测试验收

- 登录成功生成 `sessionId`，写入带 sessionId 的 Redis key。
- 同一账号连续登录两次，两个 token 均可访问。
- 使用会话 A 登出后，会话 A 返回 401。
- 会话 A 登出后，会话 B 仍可正常访问。
- 无效 token、过期 token、会话不存在、jti 不匹配仍返回 401。
- 单元测试、E2E、lint、类型检查和 build 全部通过。

## 文档同步

- 更新项目根目录 `api-docs.md`，将“单端登录/顶号”改为“多端登录/当前会话登出”。
- 更新 `docs/auth-login-sequence.md`，补充 sessionId 生成及多端会话流程。
- 更新根目录 `AGENTS.md` 的认证约定。
