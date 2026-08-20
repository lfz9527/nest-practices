# Redis 与应用健康检查设计

## 1. 背景与目标

当前 Redis 使用 ioredis 默认连接与重连策略，缺少连接超时、命令超时、重试上限和统一健康检查；应用也未启用 Nest shutdown hooks，容器收到 SIGTERM/SIGINT 时无法稳定触发 Redis 与数据库的优雅关闭。

本次目标：

- 为 Redis 增加可配置的连接超时、命令超时和有限重连策略。
- Redis 重连耗尽后停止自动重连，但应用继续运行。
- 新增统一公开健康接口 `GET /health`，检查 Redis 与 MySQL。
- 任一依赖不可用时，健康接口返回 HTTP 503。
- 启用 SIGTERM、SIGINT 的 Nest shutdown hooks，确保 Redis、数据库和其他 provider 参与优雅关闭。

## 2. 方案范围

只提供一个健康接口，不拆分存活和就绪接口：

```http
GET /health
```

接口标记为公开接口，不要求 JWT。健康接口直接检查当前依赖状态，不使用缓存的上次检查结果。

引入 `@nestjs/terminus` 作为统一健康检查基础设施。通过 Terminus 的健康检查模块、Redis indicator 和 TypeORM indicator 复用标准探针语义，避免在应用层手工维护依赖探测、状态汇总和 HTTP 503 响应逻辑。

## 3. Redis 连接设计

在 `config.yaml` 的 `redis` 节点增加配置，并为每项配置保留中文注释，明确用途、单位和取值含义：

```yaml
redis:
  # 建立 Redis TCP 连接的超时时间，单位：毫秒
  connectTimeout: 5000
  # 单条 Redis 命令的超时时间，单位：毫秒
  commandTimeout: 3000
  # 自动重连的最大尝试次数，达到上限后停止重连但不退出应用
  maxRetries: 5
  # 单次重连退避时间的最大值，单位：毫秒
  retryDelayMax: 2000
```

`RedisService` 创建 ioredis 客户端时读取上述配置：

- `connectTimeout` 控制建立连接的最长等待时间。
- `commandTimeout` 控制单条 Redis 命令的最长等待时间。
- `maxRetries` 控制自动重连尝试次数。
- `retryDelayMax` 限制重连退避时间上限。

采用有限退避重连策略。达到 `maxRetries` 后停止继续自动重连并记录明确错误，但不调用进程退出；应用仍保持运行，依赖 Redis 的业务请求按现有错误链路失败。

RedisService 增加轻量 `ping()` 方法供健康接口调用。连接状态事件至少记录连接成功、准备就绪、连接错误和连接结束，以便观察恢复与故障状态。

应用关闭时继续调用 `quit()`。关闭逻辑需要避免客户端已断开或重复关闭造成不必要的异常。

## 4. 健康接口设计

引入 `@nestjs/terminus` 作为统一健康检查基础设施。通过 Terminus 的健康检查模块、Redis indicator 和 TypeORM indicator 复用标准探针语义，避免在应用层手工维护依赖探测、状态汇总和 HTTP 503 响应逻辑。

健康模块提供：

```http
GET /health
```

接口通过 Terminus 的 `HealthCheckService` 编排 Redis 与 TypeORM 检查，并标记为公开接口，不要求 JWT。检查当前依赖状态，不使用缓存的上次检查结果。

检查项：

- 使用 `RedisHealthIndicator` 检查 Redis `ping`。
- 使用 `TypeOrmHealthIndicator` 检查 TypeORM 数据库连接。

两项检查均成功时返回 HTTP 200；任一检查失败时由 Terminus 返回 HTTP 503。健康接口需要接入项目现有响应和异常处理约定，同时保留 Terminus 的 HTTP 503 语义，不能被全局响应转换逻辑降级为 HTTP 200。响应中不得包含连接凭据、内部异常堆栈或数据库连接细节。

健康检查异常时必须输出专用告警日志，至少包含健康检查接口路径、失败的依赖名称、脱敏白名单健康结果和请求标识；日志使用项目现有 Pino Logger，不记录原始异常对象、密码、连接字符串或完整内部堆栈。Redis 和数据库同时异常时应在同一条健康检查异常日志中汇总两项失败状态，避免仅记录其中一项。

成功和失败响应以 Terminus 标准结构为基础，具体字段由所使用的 `@nestjs/terminus` 版本确定；失败响应仅保留预期的 `status`、`info`、`error`、`details` 结构及依赖状态，不重复实现依赖状态汇总，也不暴露探针原始错误内容。

## 5. 进程关闭设计

在 `main.ts` 创建应用后启用：

```ts
app.enableShutdownHooks(['SIGTERM', 'SIGINT'])
```

收到 SIGTERM 或 SIGINT 时由 Nest 触发应用关闭生命周期，确保：

- RedisService 执行 `onApplicationShutdown()` 并关闭 Redis 连接。
- TypeORM 执行内置连接销毁逻辑。
- 其他 Nest provider 按生命周期顺序完成关闭。

现有不可恢复异常的关闭回调继续调用 `app.close()`，不改变当前异常退出语义。

## 6. 测试设计

补充或调整以下测试：

- Redis 客户端收到正确的连接超时、命令超时和重连配置。
- 重连退避遵守配置的次数上限和时间上限。
- 重连耗尽后不触发进程退出。
- `ping()` 成功和失败场景。
- Redis shutdown 调用 `quit()`，且重复关闭可安全处理。
- 引入 `@nestjs/terminus` 并注册 `TerminusModule`。
- 配置 Redis 与 TypeORM 健康指示器。
- 验证健康接口成功返回 200，任一依赖失败时由 Terminus 返回 503。
- 验证健康接口不要求 JWT。
- 验证健康响应不会泄露连接凭据、内部异常堆栈或数据库细节。
- 验证健康检查异常输出专用结构化日志，包含接口路径、失败依赖、检查结果和请求标识，且不包含敏感连接信息。
- `main.ts` 启用 SIGTERM、SIGINT shutdown hooks。
- 现有认证、用户、错误处理和 Redis 测试保持通过。

## 7. 非目标

- 不新增存活/就绪两个独立接口。
- 不改变 Redis 业务调用方的接口。
- 不在 Redis 失败时主动终止应用进程。
- 不新增定时健康检查任务。
- 不在应用层重复实现 Terminus 已提供的健康状态汇总和 HTTP 503 处理。
- 不重构现有异常处理、日志或数据库模块之外的无关代码。
