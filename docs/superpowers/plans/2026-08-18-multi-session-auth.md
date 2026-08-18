# 多端认证会话实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前单端 JWT 会话改为服务端生成 `sessionId` 的多端会话，登录互不覆盖，登出只使当前会话失效。

**Architecture:** 登录时后端生成 `sessionId` 与 `jti`，将两者写入 access token，并把 jti 按 `auth:session:{userId}:{sessionId}` 存入 Redis。JwtStrategy 使用 token 中的 `sub/sessionId/jti` 查 Redis 校验当前会话；AuthService.logout 只删除当前会话 key。

**Tech Stack:** NestJS 11、TypeScript 5.7、JWT、passport-jwt、ioredis、Redis、Jest、supertest。

## Global Constraints

- access token 有效期保持 7 天，前端不提交设备 ID，也没有 refresh token。
- Redis key 必须为 `auth:session:{userId}:{sessionId}`，value 为 jti，TTL 使用 `jwt.accessExpiresIn`。
- token payload 必须包含 `{ sub, email, sessionId, jti, type: 'access' }`。
- 401 仍使用项目现有 `AppError(ErrorCodes.UNAUTHORIZED, '未登录或登录状态过期')` 业务错误契约。
- 保持无分号、单引号、尾逗号、LF；校验消息使用中文。
- 每次代码行为修改必须同步单测/E2E、`api-docs.md`、`AGENTS.md` 与 `docs/auth-login-sequence.md`。

---

### Task 1: 会话模型与登录服务

**Files:**
- Modify: `src/auth/auth.service.ts`
- Test: `src/auth/auth.service.spec.ts`

**Interfaces:**
- Produces `SESSION_KEY_PREFIX = 'auth:session:'`、`AccessTokenPayload` 增加 `sessionId`、`AuthService.login()` 返回 `{ access_token, user }`、`logout(userId, sessionId)`。

- [ ] **Step 1: 更新单测**：登录断言服务端生成 `sessionId`，签发 payload 含 `sessionId/jti`，Redis 写入 `${SESSION_KEY_PREFIX}1:<sessionId>`；增加两个登录 token 的 Redis key 不同且均可存在；登出断言删除指定会话 key。
- [ ] **Step 2: 运行 `npx jest src/auth/auth.service.spec.ts`**，预期旧实现相关断言失败。
- [ ] **Step 3: 实现最小改动**：登录分别调用 `randomUUID()` 生成 sessionId/jti；`signAccess` 接收 sessionId；Redis key 拼接 userId/sessionId；logout 接收并删除指定 key。
- [ ] **Step 4: 运行该单测，预期全部通过。**
- [ ] **Step 5: 提交：`feat: 支持多端会话登录与当前会话登出`。**

### Task 2: JWT 策略与控制器

**Files:**
- Modify: `src/auth/jwt.strategy.ts`
- Modify: `src/auth/auth.controller.ts`
- Test: `src/auth/auth.guard.spec.ts`
- Test: `src/auth/auth.controller.spec.ts`

**Interfaces:**
- JwtStrategy 构造注入 RedisService；`validate(payload)` 按 `sub + sessionId` 查询 jti。
- logout 从 `req.user` 读取 `sub/sessionId` 并调用 `logout(sub, sessionId)`。

- [ ] **Step 1: 更新测试**：策略 mock Redis 校验匹配放行、缺失/不匹配拒绝；controller logout 断言传递 sessionId。
- [ ] **Step 2: 运行守卫和 controller 单测，预期旧构造签名/旧 logout 断言失败。**
- [ ] **Step 3: 实现策略会话校验与当前会话登出。**
- [ ] **Step 4: 运行 `npx jest src/auth/auth.guard.spec.ts src/auth/auth.controller.spec.ts`，预期通过。**
- [ ] **Step 5: 提交：`feat: 按会话校验 JWT 并支持当前会话登出`。**

### Task 3: E2E 多端行为

**Files:**
- Modify: `src/auth/auth.e2e-spec.ts`

**Interfaces:**
- E2E 覆盖同账号两个 token 同时可用、A 登出后 A 失效、B 仍可用。

- [ ] **Step 1: 添加测试**：登录两次捕获两次 jti；分别让 Redis mock 返回对应 jti；验证两个 token 请求均返回 code 0；logout A 后让 A 对应 key 返回 null、B 对应 key 仍返回 jti，分别断言 401/0。
- [ ] **Step 2: 运行 `npx jest --config test/jest-e2e.json src/auth/auth.e2e-spec.ts`，预期新用例通过。**
- [ ] **Step 3: 运行 `npm test && npm run test:e2e`，预期全部测试通过。**
- [ ] **Step 4: 提交：`test: 补充多端会话登录与当前会话登出测试`。**

### Task 4: 文档同步与最终验证

**Files:**
- Modify: `api-docs.md`
- Modify: `AGENTS.md`
- Modify: `docs/auth-login-sequence.md`

- [ ] **Step 1: 更新前端文档**：删除单端顶号描述，改为“同一账号可多端登录；401 只代表当前 token 失效；登出只影响当前会话”。
- [ ] **Step 2: 更新时序图**：补充服务端生成 sessionId、多端 Redis key、当前会话登出不影响其他会话。
- [ ] **Step 3: 更新项目约定**：将 Redis key 与多端会话语义写入 AGENTS.md。
- [ ] **Step 4: 运行 `pnpm lint && npx tsc --noEmit && pnpm test && pnpm test:e2e && pnpm build`，全部退出码为 0。**
- [ ] **Step 5: 提交：`docs: 更新多端认证会话接口与时序文档`。**

## 自审结论

- 覆盖设计文档全部要求：sessionId 服务端生成、token payload、Redis key、鉴权、当前会话登出、多端 E2E、三份文档同步。
- 无 refresh、无设备 ID 请求参数、无退出所有设备接口，范围明确。
- 测试中的 Redis mock 必须按 sessionId 区分，避免用单一全局 jti 误判多端场景。
