# nest-practices

NestJS 11 企业级实践项目 —— TypeORM + MySQL + Pino 日志 + 统一错误处理 + YAML 配置。

## 技术栈

- **框架**: NestJS 11 + Express + TypeScript 5.7
- **模块解析**: NodeNext / target ES2023
- **包管理**: pnpm
- **测试**: Jest 30 + ts-jest + supertest（E2E）
- **代码规范**: ESLint 9 flat config + Prettier 3
- **Git 钩子**: husky + lint-staged（pre-commit 自动 lint + test）
- **数据库**: MySQL 8 + TypeORM 1.1（`autoLoadEntities`，开发环境 `synchronize` 自动同步）
- **日志**: Pino + nestjs-pino（开发期 pino-pretty 可读输出，生产 JSON 轮转归档）
- **配置**: YAML 文件（`config.yaml`），通过 `@nestjs/config` + `js-yaml` 加载
- **认证**: JWT 单 token（7 天）+ Redis 会话校验（单端顶号、登出即时失效，无 refresh 续期）
- **Redis**: ioredis（开发环境：WSL 内 Redis，Windows 经 portproxy 访问 127.0.0.1:6379）

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
pnpm redis:link       # WSL Redis 端口转发到 127.0.0.1:6379（需管理员，WSL 重启后重跑）
pnpm commit           # commitizen 交互式提交（git add . + git-cz）
pnpm clean            # 清空 node_modules + lock 文件
git commit            # 经 husky：pre-commit 运行 npm test，commit-msg 校验格式
```

## 架构

```
src/
├── main.ts                 # 入口
├── app/                    # 根模块
├── config/                 # YAML 配置加载
├── database/               # TypeORM + MySQL
├── redis/                  # Redis 全局模块（ioredis 封装 get/set/del）
├── common/                 # 统一错误处理、响应拦截、Pino 日志
├── users/                  # 用户查询（User 实体含 delFlag 软删除，现仅 GET /users/:id）
└── auth/                   # 认证（登录/刷新/登出 + 全局 JwtAuthGuard）
```

## 约定

### 响应契约
- **成功**: HTTP 200, body `{ code: 0, message: 'ok', data: ... }`
- **业务错误**: HTTP 200, body `{ code: -1 (or custom), message: '描述', data: null }` — 用 `AppError` 抛出，错误码集中定义于 `common/errors/error-codes.ts`
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
- husky pre-commit 仅运行 `npm test`；commit-msg 经 commitlint 校验格式（lint-staged 已配置但未挂载）

### Commit 规范
- 格式：`<type>: <subject>`，subject 不超过 100 字符
- type 必须为以下之一：`feat` `fix` `ui` `util` `style` `refactor` `docs` `test` `chore` `add` `del` `revert` `release` `deploy` `init`
- husky commit-msg 钩子校验格式，不符合则阻止提交

### 认证（单 JWT + Redis 会话）
- 接口：`POST /auth/login`、`POST /auth/logout`；login 标 `@Public()`，logout 走守卫（**无 refresh 接口**，token 过期前端直接重新登录）
- access payload `{ sub, email, jti, type: 'access' }`，有效期 7 天（config `jwt.accessExpiresIn`）
- 会话存 Redis `auth:session:{userId}`（value=jti，TTL=access 有效期），登录覆盖写即单端顶号；守卫每请求比对 Redis jti，不一致（顶号/登出）抛 401
- 登出：DEL Redis key，该 token 立即失效
- 全局守卫 `JwtAuthGuard`：未标 `@Public()` 的接口需 `Authorization: Bearer <access>`；401 走业务错误形态（HTTP 200 + body.code 401，AppError(UNAUTHORIZED)）
- 登录失败统一文案「账号或密码错误」（不暴露账号状态）；status=1 抛「账号已被停用」
- 开发环境 Redis：WSL 内 Redis（密码 root，监听 0.0.0.0），`pnpm redis:link` 配置 portproxy 后连 127.0.0.1:6379

## Notes

<!-- 快速记录区 -->
