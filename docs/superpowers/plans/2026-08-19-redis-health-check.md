# Redis 与应用健康检查实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 NestJS 应用增加基于 `@nestjs/terminus` 的统一 `GET /health` 健康检查，并完善 Redis 超时、有限重连、异常日志和 SIGTERM/SIGINT 优雅关闭。

**Architecture:** 保留现有 `RedisService` 作为业务 Redis 客户端封装，在其中增加配置化连接参数、有限重连和 `ping()` 能力。新增健康模块使用 Terminus 的 `HealthCheckService`、Redis indicator 和 TypeORM indicator 统一探测依赖；健康接口公开访问，依赖失败由 Terminus 返回 HTTP 503。应用入口启用 Nest shutdown hooks，使 Redis 和 TypeORM 参与统一关闭生命周期。

**Tech Stack:** NestJS 11、`@nestjs/terminus`、ioredis、TypeORM、MySQL、nestjs-pino、Jest 30、Supertest、YAML 配置。

## Global Constraints

- Redis 连接超时、命令超时、最大重连次数和退避上限必须从 `config.yaml` 读取，并为每项配置添加中文注释说明用途、单位和含义。
- Redis 重连耗尽后停止自动重连，但不得主动退出应用。
- 健康接口只提供公开 `GET /health`，不拆分 `/live` 和 `/ready`。
- Redis 或数据库检查失败时，健康接口必须保留 HTTP 503 语义，不能被全局响应拦截器降级为 HTTP 200。
- 健康检查异常必须通过现有 Pino Logger 输出专用结构化日志，包含接口路径、失败依赖、检查结果和请求标识，不输出密码、连接字符串或敏感内部细节。
- 必须启用 `SIGTERM`、`SIGINT` 的 Nest shutdown hooks；应用关闭时 Redis 和 TypeORM 必须获得生命周期关闭机会。
- 遵循项目无分号、单引号、尾逗号和精准局部修改约定。

---

### Task 1: 添加依赖和 Redis 配置

**Files:**
- Modify: `package.json`
- Modify: `config.yaml`
- Test: `src/redis/redis.service.spec.ts`

**Interfaces:**
- Produces `redis.connectTimeout`、`redis.commandTimeout`、`redis.maxRetries`、`redis.retryDelayMax` 配置项。
- Adds `@nestjs/terminus` runtime dependency for later health module tasks.

- [ ] **Step 1: Add the dependency without changing unrelated package entries**

在 `dependencies` 中加入与项目 Nest 11 兼容的 `@nestjs/terminus` 版本，保留现有依赖排序和脚本。

- [ ] **Step 2: Add documented YAML values**

在 `config.yaml` 的 `redis` 节点增加：

```yaml
  # 建立 Redis TCP 连接的超时时间，单位：毫秒
  connectTimeout: 5000
  # 单条 Redis 命令的超时时间，单位：毫秒
  commandTimeout: 3000
  # 自动重连的最大尝试次数，达到上限后停止重连但不退出应用
  maxRetries: 5
  # 单次重连退避时间的最大值，单位：毫秒
  retryDelayMax: 2000
```

- [ ] **Step 3: Install the lockfile update**

Run: `pnpm install`
Expected: `package.json` and `pnpm-lock.yaml` contain `@nestjs/terminus`; install exits successfully.

- [ ] **Step 4: Verify configuration text and dependency diff**

Run: `git diff --check && grep -n -A12 '^redis:' config.yaml`
Expected: no whitespace errors; all four Redis parameters have Chinese comments.

---

### Task 2: Harden RedisService with finite reconnects and ping

**Files:**
- Modify: `src/redis/redis.service.ts`
- Modify: `src/redis/redis.service.spec.ts`

**Interfaces:**
- `RedisService.ping(): Promise<'PONG'>` delegates to the ioredis client.
- Existing `get`, `set`, `del`, and `onApplicationShutdown` behavior remains available.
- The ioredis constructor receives `connectTimeout`, `commandTimeout`, and a `retryStrategy` derived from config.

- [ ] **Step 1: Extend the Jest client mock before implementation**

Add `ping`, `status`, and event capture support to `mockClient`. Add config mock values for all four new keys. Add tests that assert the Redis constructor receives the configured timeout values and a retry strategy.

- [ ] **Step 2: Run the focused test to confirm the new assertions fail**

Run: `pnpm test -- --runInBand src/redis/redis.service.spec.ts`
Expected: FAIL because the service does not yet pass the new ioredis options or expose `ping()`.

- [ ] **Step 3: Implement the minimal configured client**

Construct ioredis with:

```ts
connectTimeout: configService.get<number>('redis.connectTimeout'),
commandTimeout: configService.get<number>('redis.commandTimeout'),
maxRetriesPerRequest: 1,
retryStrategy: (times: number) => {
  const maxRetries = configService.get<number>('redis.maxRetries') ?? 5
  const retryDelayMax = configService.get<number>('redis.retryDelayMax') ?? 2000
  return times > maxRetries
    ? null
    : Math.min(times * 200, retryDelayMax)
},
```

Keep the existing Redis host, port, password and error logging. Add connection lifecycle logging for `ready` and `end`, add `ping()`, and make shutdown safe when the client is already closed or closing. Do not call `process.exit()` from RedisService.

- [ ] **Step 4: Add health and shutdown unit tests**

Cover `ping()` delegation, `quit()` on shutdown, and the retry strategy returning a delay within the configured limit and `null` after the configured attempt count. Assert lifecycle errors are logged through the existing logger without exposing credentials.

- [ ] **Step 5: Run the focused test to verify the implementation**

Run: `pnpm test -- --runInBand src/redis/redis.service.spec.ts`
Expected: PASS for all RedisService tests.

---

### Task 3: Add Terminus health module and public endpoint

**Files:**
- Create: `src/health/health.module.ts`
- Create: `src/health/health.controller.ts`
- Create: `src/health/health.controller.spec.ts`
- Modify: `src/app/app.module.ts`

**Interfaces:**
- `GET /health` is public and uses `HealthCheckService`.
- The endpoint runs Redis and TypeORM checks through Terminus indicators.
- Success returns HTTP 200; dependency failure returns HTTP 503.

- [ ] **Step 1: Write controller tests with mocked Terminus indicators**

Create a testing module with mocked `HealthCheckService`, `RedisHealthIndicator`, `TypeOrmHealthIndicator`, and `Logger`. Assert the controller is public, calls both checks, and propagates a `HealthCheckError` so Terminus can produce HTTP 503. Also assert the success path returns the health-check result.

- [ ] **Step 2: Run the focused test to confirm it fails**

Run: `pnpm test -- --runInBand src/health/health.controller.spec.ts`
Expected: FAIL because the health module and controller do not exist.

- [ ] **Step 3: Implement `HealthModule` and `HealthController`**

Register `TerminusModule` in `HealthModule`. Inject `HealthCheckService`, `RedisHealthIndicator`, `TypeOrmHealthIndicator`, and the project `Logger`. Implement a public `@Get('health')` method that calls:

```ts
return this.healthCheckService.check([
  () => this.redisHealthIndicator.pingCheck('redis'),
  () => this.typeOrmHealthIndicator.pingCheck('database'),
])
```

Use Terminus standard response/error handling rather than manually querying `DataSource` or manually aggregating dependency states. Ensure the controller is not protected by the global JWT guard by applying `@Public()`.

- [ ] **Step 4: Add dedicated failure logging**

Wrap the Terminus check call so failed health checks emit one structured warning/error log through `nestjs-pino` containing `path: '/health'`, failed dependency names, health result, and request id from the request context. Exclude credentials, connection strings, and raw sensitive internals. Re-throw the original Terminus health-check error so the HTTP status remains 503.

- [ ] **Step 5: Register the module**

Import `HealthModule` in `src/app/app.module.ts` without changing unrelated module ordering or providers.

- [ ] **Step 6: Run the focused tests**

Run: `pnpm test -- --runInBand src/health/health.controller.spec.ts`
Expected: PASS, including success, dependency failure, public access metadata, and structured failure logging assertions.

---

### Task 4: Enable graceful signal shutdown

**Files:**
- Modify: `src/main.ts`
- Create or modify: `src/main.spec.ts` only if the existing Jest setup can test bootstrap without starting a real server

**Interfaces:**
- Nest application calls `enableShutdownHooks(['SIGTERM', 'SIGINT'])` before listening.
- Existing `app.close()` shutdown path remains intact for uncaught exceptions.

- [ ] **Step 1: Add a bootstrap test seam or focused assertion**

If `main.ts` currently cannot be imported without executing bootstrap, extract only the minimal application setup helper needed to test shutdown-hook registration; do not refactor unrelated bootstrap behavior. Assert `enableShutdownHooks` receives `['SIGTERM', 'SIGINT']`.

- [ ] **Step 2: Run the focused test to confirm the missing hook is detected**

Run: `pnpm test -- --runInBand src/main.spec.ts`
Expected: FAIL before the hook is added, or the test is skipped only if the project setup cannot safely import `main.ts`; in that case verify the call through a targeted static test or documented manual assertion.

- [ ] **Step 3: Enable the hooks**

Immediately after creating the Nest application and before `app.listen(port)`, add:

```ts
app.enableShutdownHooks(['SIGTERM', 'SIGINT'])
```

Leave existing `errorHandler.registerShutdown`, `app.close()`, and `process.exit(1)` behavior unchanged.

- [ ] **Step 4: Run application-level tests**

Run: `pnpm test -- --runInBand`
Expected: all existing and new unit tests pass.

---

### Task 5: Add endpoint-level verification and update design documentation

**Files:**
- Modify: `src/health/health.controller.spec.ts` or add `src/health/health.e2e-spec.ts`
- Modify: `docs/superpowers/specs/2026-08-19-redis-health-check-design.md`

**Interfaces:**
- Verifies the externally observable `/health` HTTP status and public-access behavior.

- [ ] **Step 1: Add endpoint-level tests**

Use the project’s existing Nest testing pattern to verify:

```ts
await request(app.getHttpServer()).get('/health').expect(200)
```

with healthy mocked indicators, and `.expect(503)` when either indicator rejects. Verify no `Authorization` header is needed and the response does not include credentials or raw stack traces.

- [ ] **Step 2: Add the required documentation details**

Keep the design document aligned with the implementation: retain the commented YAML settings, Terminus indicators, HTTP 503 behavior, dedicated structured health-failure logging, and shutdown hooks.

- [ ] **Step 3: Run formatting, lint, build, and all tests**

Run:

```bash
pnpm format
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
```

Expected: all commands succeed; any environment-dependent e2e database/Redis failures must be reported with their exact output rather than hidden.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check && git status --short && git diff --stat`
Expected: only the planned dependency, configuration, health, shutdown, test, lockfile, and documentation files are modified.
