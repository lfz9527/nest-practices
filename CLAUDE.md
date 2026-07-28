# nest-practices

NestJS 11 企业级实践项目 —— TypeORM + MySQL + Pino 日志 + 统一错误处理 + YAML 配置。

## 技术栈

- **框架**: NestJS 11 + Express + TypeScript 5.7
- **模块解析**: NodeNext / target ES2023
- **包管理**: pnpm
- **测试**: Jest 30 + ts-jest + supertest（E2E）
- **代码规范**: ESLint 9 flat config + Prettier 3
- **数据库**: MySQL 8 + TypeORM 1.1（`autoLoadEntities`，开发环境 `synchronize` 自动同步）
- **日志**: Pino + nestjs-pino（开发期 pino-pretty 可读输出，生产 JSON 轮转归档）
- **配置**: YAML 文件（`config.yaml`），通过 `@nestjs/config` + `js-yaml` 加载

## 常用命令

```bash
pnpm start:dev        # 开发模式（热重载，默认端口 3000，端口由 config.yaml 控制）
pnpm build            # 生产构建 → dist/
pnpm start:prod       # 运行构建产物（node dist/main）
pnpm start:debug      # 调试模式（--debug --watch）
pnpm lint             # ESLint 检查并自动修复
pnpm format           # Prettier 格式化 src/ 和 test/
pnpm test             # 运行单元测试（*.spec.ts）
pnpm test:e2e         # 运行 E2E 测试（*.e2e-spec.ts，配置 test/jest-e2e.json）
pnpm test:cov         # 运行测试并生成覆盖率报告
pnpm seed             # 创建初始用户（admin@example.com / 123456）
pnpm clean            # 清空 node_modules + lock 文件
```

## 架构

```
src/
├── main.ts                         # 入口：NestFactory 启动，挂载进程钩子
├── app/
│   ├── app.module.ts               # 根模块，引入所有子模块
│   ├── app.controller.ts           # GET /
│   └── app.service.ts
├── config/
│   └── config.module.ts            # YAML 配置加载（@nestjs/config + js-yaml，全局）
├── database/
│   ├── database.module.ts          # TypeORM 异步配置（ConfigService 注入）
│   └── seed.ts                     # 初始用户播种脚本（bcryptjs 加密密码）
├── common/
│   ├── types.ts                    # ResponseBody<T> 统一响应体接口
│   ├── errors/
│   │   ├── errors.module.ts        # 全局 APP_FILTER + ErrorHandler 提供
│   │   ├── app-error.ts            # 唯一错误模型（code 属性区分，不建子类）
│   │   ├── error-codes.ts          # 错误码常量（BIZ_ERROR: -1）
│   │   ├── error-handler.ts        # 集中错误处理器（可信度/分层日志/优雅退出）
│   │   └── all-exceptions.filter.ts# 全局异常过滤器（转发至 ErrorHandler）
│   ├── interceptors/
│   │   └── transform.interceptor.ts# 成功响应统一包裹 { code:0, message:'ok', data }
│   └── logging/
│       └── logging.module.ts       # Pino 结构化日志（请求ID/串化/轮转归档）
└── users/
    ├── users.module.ts             # 用户功能模块
    ├── user.entity.ts              # TypeORM 实体（users 表，软删除 delFlag）
    ├── users.controller.ts         # GET /users/:id
    ├── users.service.ts            # findById（含业务错误抛出）
    ├── users.service.spec.ts       # 单元测试
    ├── users.e2e-spec.ts           # E2E 测试（与本模块同目录存放）
    └── dto/
        ├── create-user.dto.ts      # 创建用户 DTO（class-validator 中文校验消息）
        └── update-user.dto.ts      # 更新用户 DTO
```

## 约定

### 响应契约
- **成功**: HTTP 200, body `{ code: 0, message: 'ok', data: ... }`
- **业务错误**: HTTP 200, body `{ code: -1 (or custom), message: '描述', data: null }` — 用 `AppError` 抛出
- **系统错误**: HTTP 4xx/5xx, body `{ code: 同HTTP状态码, message: '描述', data: null }`
- **未知异常**: HTTP 500, body `{ code: 500, message: '服务器内部错误', data: null }` — 不泄露内部细节

### 错误处理
- 唯一错误模型 `AppError`，用 `code` 属性区分（不要建子类）
- `isOperational` 标记可信度：可信错误不触发进程退出；不可信错误（裸 Error、`isOperational=false`）触发优雅关闭
- 所有异常最终汇集到 `ErrorHandler.handleError()`，不分散在各控制器或过滤器

### 日志
- nestjs-pino 全局接管（`bufferLogs: true` 启动后移交）
- 请求级日志自动生成 `req.id`（优先 `x-request-id` 请求头，否则 `randomUUID()`）
- 开发环境 `config.yaml` 的 `logger.pretty: true` 走 pino-pretty；生产 JSON 轮转（info + error 分离归档）
- Windows 下 `process.stdout.setDefaultEncoding('utf-8')` 防止中文乱码

### 数据库
- TypeORM 实体与 MySQL 表对应，软删除用 `delFlag: 0/2`，唯一约束 `(email, delFlag)`
- `synchronize: true` 仅开发环境（`env: development`），生产需关闭
- 播种通过 `pnpm seed`（独立 ApplicationContext），不直接执行 SQL INSERT

### 代码风格
- 无分号（`semi: false`），单引号，尾逗号，LF 换行
- `@typescript-eslint/no-explicit-any` 关闭
- ESLint 类型检查规则（`recommendedTypeChecked`）+ `projectService: true`
- 参数校验：`ValidationPipe({ whitelist: true })` + class-validator 装饰器，校验消息用中文
- 文件组织：单元测试 `*.spec.ts` 与被测文件同目录；E2E 测试 `*.e2e-spec.ts` 可在任意目录（由 `testRegex` 匹配）

## Notes

<!-- 快速记录区 -->
