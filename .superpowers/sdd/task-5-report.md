# Task 5 修复报告

## 状态

已完成 P1/P2 评审问题修复，并保留原有未提交源码改动；仅提交功能与测试文件，不提交设计文档目录。

## 修复

- `src/common/errors/error-handler.ts`
  - 仅识别具有 Terminus 健康响应结构的异常。
  - 保留 HTTP 503、`status/info/error/details` 白名单数据，details 仅输出 up/down 状态。
  - 普通 HttpException 仍返回 `data: null`。
- `src/health/health.controller.spec.ts`
  - 增加真实全局错误处理与响应拦截管线 HTTP 断言，覆盖 Redis、database 失败和敏感信息过滤。
- `src/main.setup.ts`、`src/main.ts`、`src/main.spec.ts`
  - 抽取最小运行时 setup helper，测试真实调用及 `enableShutdownHooks(['SIGTERM', 'SIGINT'])` 配置顺序。
  - bootstrap 行为保持不变。
- `src/redis/redis.service.ts`、`src/redis/redis.service.spec.ts`
  - connecting/reconnecting 直接 disconnect；ready 仍 quit；end/close 不重复关闭。

## 精确验证

- `pnpm test`：通过，9 suites、47 tests。
- `pnpm test:cov`：通过，9 suites、47 tests；总覆盖率 statements 56.54%、branches 71.82%、functions 61.7%、lines 54.22%。
- `pnpm test:e2e`：通过，2 suites、9 tests。
- `pnpm lint`：通过，退出码 0。
- `pnpm build`：通过，退出码 0。
- `pnpm exec tsc --noEmit`：通过。
- `pnpm exec eslint` 修改文件：通过。
- `git diff --check`：通过。
- `pnpm format`：失败，退出码 2；`src/**/*.ts` 已全部 unchanged，仓库没有匹配的 `test/**/*.ts` 文件，Prettier 报 `No files matching the pattern were found: "test/**/*.ts"`。未修改脚本。

## 注意

覆盖率命令会输出健康检查失败日志，这是测试构造的敏感输入，不会进入 HTTP 响应；HTTP 断言已验证响应不含凭据、密码、堆栈等内容。
