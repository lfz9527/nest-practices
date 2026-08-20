# Task 3 Report

## 状态

完成 Task 3 reviewer P1/P2 修复。保留公开 `GET /health`、Terminus indicators，未修改 `main.ts`。

## 修复内容

- `health.module.ts` 移除重复注册的 `HealthCheckService` 与 `TypeOrmHealthIndicator`，仅通过 `TerminusModule` 提供 Terminus 服务，并导入实际的 `DatabaseModule`、`RedisModule` 与日志模块。
- `health.controller.ts` 按 Terminus 实际失败路径从 `ServiceUnavailableException.getResponse()` 读取健康结果，从 `details` 提取 down 依赖，并原样重新抛出异常以保留 HTTP 503 语义。
- 健康失败日志仅记录 `path`、`failedDependencies`、`healthResult`、`requestId`，不记录原始异常、凭据、连接字符串或堆栈。
- `health.controller.spec.ts` 增加 ServiceUnavailableException/503 语义、敏感异常信息不进入日志、真实健康模块编译与依赖解析测试。

## 验证结果

- `pnpm exec jest --runInBand src/health/health.controller.spec.ts --forceExit`：通过，1 个测试套件、5 个测试通过。
- `pnpm exec jest --runInBand src/health src/redis`：通过，2 个测试套件、17 个测试通过；模块测试触发异步客户端句柄，未自动退出，验证后停止残留进程。
- `pnpm build`：失败，仅发现 Task 2 既有错误：`src/redis/redis.service.ts:35,38` 的 `Logger.info` 类型错误（`nestjs-pino` `Logger` 类型不含 `info`）。本次 Task 3 修改未引入新的 build 错误。
- `git diff --check`：通过。

## 疑虑

- 当前环境 Redis 未运行，真实模块编译测试中会出现 `127.0.0.1:6379` 连接拒绝日志；测试通过覆盖 `RedisService` 避免依赖外部服务。
- 测试命令使用 `--forceExit` 处理测试环境未自动关闭的异步句柄。

## Task 3 最新复审修复追加（2026-08-19）

### 修复内容

- `health.controller.ts` 使用 Nest `@Req()` 注入 Express request，并仅读取 `request.id`；失败路径原样重新抛出 `ServiceUnavailableException`，保留 HTTP 503。
- 健康失败日志将 `healthResult` 投影为白名单：顶层 `status`、依赖名及 `up/down` 状态；过滤 `error` 原文、连接串和堆栈。
- `health.controller.spec.ts` 增加真实 HTTP 层最小 Nest app，注册全局 `JwtAuthGuard`；验证无 Authorization 的公开 `/health` 返回 200，indicator 失败实际返回 503，并验证请求 ID进入健康失败日志。
- 修复 Promise 断言为 `await expect(...).resolves/rejects`，并等待 `moduleRef.resolve`；测试结束显式关闭 app/module，未使用 `forceExit`。
- 修复 `src/health` 的 ESLint、Prettier 与测试 type-safety 问题；未修改 `main.ts` 或 Task 2 业务逻辑。

### 验证结果

- `pnpm exec jest --runInBand src/health/health.controller.spec.ts`：通过，1 个测试套件、6 个测试通过。
- `pnpm exec jest --runInBand src/redis src/health/health.controller.spec.ts`：通过，2 个测试套件、18 个测试通过；无 `forceExit`，正常退出。
- `pnpm exec eslint src/health --max-warnings=0`：通过，0 errors、0 warnings。
- `pnpm build`：失败，仅有 Task 2 既有错误：`src/redis/redis.service.ts:35,38` 的 `Logger.info` 类型错误（`nestjs-pino` `Logger` 类型不含 `info`）；未修改该文件。

### 疑虑

- 失败日志白名单按依赖状态投影，Terminus 之外的异常只记录固定安全字段，不输出异常对象。
- 本次真实 HTTP 测试使用最小路由测试模块并注册 `APP_GUARD`，验证了 `@Public()` 放行与 HTTP 503 语义；完整应用启动仍可能受外部 Redis/MySQL 环境影响。

## 提交

已提交：`4218f84`（`fix: 修复健康检查失败解析与模块注册`）。
