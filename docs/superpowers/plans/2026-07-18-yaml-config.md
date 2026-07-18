# 配置项迁移 YAML 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将配置管理从 `.env` 迁移为 YAML 文件，通过 `NODE_ENV` 区分开发/生产环境

**Architecture:** 保留 `@nestjs/config` ConfigModule，通过 `js-yaml` 自定义 loader 函数读取 YAML 文件。`ConfigModule.forRoot({ load: [configuration], ignoreEnvFile: true })` 替换原有的 `.env` 自动加载。

**Tech Stack:** @nestjs/config, js-yaml, TypeScript

## Global Constraints

- `NODE_ENV` 默认值 `dev`，不设环境变量时仍可正常启动
- YAML 文件注释格式：独占一行在上方，以 `#` 开头
- TypeORM 配置 key 从平铺（`DB_HOST`）改为嵌套（`database.host`）
- 不在范围内：配置校验（Joi/Zod）、配置热重载、修改 nest_sys.sql

---

### Task 1: 安装 js-yaml 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 js-yaml 及类型定义**

```bash
pnpm add js-yaml
pnpm add -D @types/js-yaml
```

- [ ] **Step 2: 验证安装**

```bash
pnpm why js-yaml
```

Expected: 显示 js-yaml 已安装及版本号

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: 添加 js-yaml 依赖用于解析 YAML 配置文件"
```

---

### Task 2: 创建 YAML 配置文件与 loader

**Files:**
- Create: `config.dev.yaml`
- Create: `config.prod.yaml`
- Create: `src/config/configuration.ts`

**Interfaces:**
- Produces: `configuration()` 函数 — 默认导出，返回解析后的配置对象 `Record<string, any>`

- [ ] **Step 1: 创建 `config.dev.yaml`**

```yaml
# config.dev.yaml — 开发环境配置

# 服务端口
port: 3000

# MySQL 数据库连接
database:
  # 数据库主机
  host: localhost
  # 数据库端口
  port: 3306
  # 数据库用户名
  username: root
  # 数据库密码
  password: ''
  # 数据库名
  database: nest_practices
```

- [ ] **Step 2: 创建 `config.prod.yaml`**

```yaml
# config.prod.yaml — 生产环境配置

# 服务端口
port: 3000

# MySQL 数据库连接
database:
  # 数据库主机
  host: localhost
  # 数据库端口
  port: 3306
  # 数据库用户名
  username: root
  # 数据库密码
  password: ''
  # 数据库名
  database: nest_practices
```

- [ ] **Step 3: 创建 `src/config/configuration.ts`**

```typescript
import { readFileSync } from 'fs'
import { load } from 'js-yaml'
import { resolve } from 'path'

export default () => {
  const env = process.env.NODE_ENV ?? 'dev'
  return load(readFileSync(resolve(`config.${env}.yaml`), 'utf8'))
}
```

- [ ] **Step 4: Commit**

```bash
git add config.dev.yaml config.prod.yaml src/config/configuration.ts
git commit -m "feat: 新增 YAML 配置文件与 loader，支持按 NODE_ENV 加载"
```

---

### Task 3: 修改 AppModule 与 main.ts 使用 YAML 配置

**Files:**
- Modify: `src/app.module.ts`
- Modify: `src/main.ts`
- Delete: `.env`

**Interfaces:**
- Consumes: `configuration` (from `src/config/configuration`)
- Produces: ConfigService 提供嵌套 key：`port`、`database.host`、`database.port`、`database.username`、`database.password`、`database.database`

- [ ] **Step 1: 修改 `src/app.module.ts`**

替换整个文件为：

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import configuration from './config/configuration'
import { UsersModule } from './users/users.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      ignoreEnvFile: true,
    }),
    UsersModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        autoLoadEntities: true,
        // synchronize: 开发环境自动同步表结构，生产环境必须关闭
        synchronize: true,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 2: 修改 `src/main.ts`**

替换整个文件为：

```typescript
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)
  await app.listen(configService.get<number>('port') ?? 3000)
}
void bootstrap()
```

- [ ] **Step 3: 删除 `.env`**

```bash
rm .env
```

- [ ] **Step 4: 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add src/app.module.ts src/main.ts
git rm .env
git commit -m "feat: 配置管理从 .env 迁移至 YAML，按 NODE_ENV 区分环境"
```

---

### Task 4: 验证构建

**Files:**
- 无（验证 only）

- [ ] **Step 1: 构建项目**

```bash
pnpm build
```

Expected: 构建成功，无错误

- [ ] **Step 2: 检查 ESLint**

```bash
pnpm lint
```

Expected: 无 lint 错误
