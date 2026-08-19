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

不引入 `@nestjs/terminus`。当前仅检查 Redis 和 TypeORM 数据库连接，复用现有依赖即可完成需求，避免增加不必要的依赖和抽象。

## 3. Redis 连接设计

在 `config.yaml` 的 `redis` 节点增加配置：

```yaml
redis:
  connectTimeout: 5000
  commandTimeout: 3000
  maxRetries: 5
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

健康检查由应用健康模块负责，注入 `RedisService` 和 TypeORM `DataSource`。

检查逻辑：

1. 调用 `RedisService.ping()` 检查 Redis。
2. 调用 `DataSource.query('SELECT 1')` 检查数据库。
3. 汇总两项状态。
4. 两项均成功时返回 HTTP 200；任一失败时返回 HTTP 503。

成功响应沿用项目统一成功响应结构：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "status": "ok",
    "redis": "up",
    "database": "up"
  }
}
```

依赖异常时返回统一系统错误结构，并保留各依赖状态：

```json
{
  "code": 503,
  "message": "服务依赖不可用",
  "data": {
    "status": "error",
    "redis": "down",
    "database": "up"
  }
}
```

健康接口必须真正返回 HTTP 503，不能被全局响应转换逻辑降级为 HTTP 200。实现应复用现有异常处理体系，并确保检查结果中的依赖状态不泄露连接凭据、内部异常堆栈或数据库细节。

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
- 数据库健康检查成功和失败场景。
- `GET /health` 无需 JWT。
- 两项依赖均正常时返回 HTTP 200 和统一成功结构。
- 任一依赖失败时返回 HTTP 503，并返回依赖状态。
- `main.ts` 启用 SIGTERM、SIGINT shutdown hooks。
- 现有认证、用户、错误处理和 Redis 测试保持通过。

## 7. 非目标

- 不新增存活/就绪两个独立接口。
- 不改变 Redis 业务调用方的接口。
- 不在 Redis 失败时主动终止应用进程。
- 不新增定时健康检查任务。
- 不引入健康检查第三方框架。
- 不重构现有异常处理、日志或数据库模块之外的无关代码。
