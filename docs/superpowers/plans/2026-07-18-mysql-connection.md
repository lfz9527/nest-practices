# MySQL 连接基础设施 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 NestJS 项目搭建 MySQL 数据库连接基础设施（TypeORM + ConfigModule）

**Architecture:** 最小化内联配置方案 — 在 `AppModule` 中直接配置 `TypeOrmModule.forRootAsync()`，通过 `ConfigService` 从 `.env` 读取数据库连接参数。`synchronize: true` 用于开发阶段自动同步表结构。

**Tech Stack:** NestJS 11, TypeORM, `@nestjs/typeorm`, `@nestjs/config`, `mysql2`

## Global Constraints

- `synchronize: true` 仅在开发阶段使用，代码中需添加注释标注生产环境需关闭
- 连接参数全部从环境变量读取，禁止硬编码
- 不创建 Entity、Migration、健康检查等超出范围的内容

---

### Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 4 个包**

```bash
pnpm add @nestjs/config @nestjs/typeorm typeorm mysql2
```

- [ ] **Step 2: 验证安装**

```bash
pnpm why @nestjs/config @nestjs/typeorm typeorm mysql2
```

Expected: 四个包均显示已安装及版本号

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add TypeORM + MySQL + ConfigModule dependencies"
```

---

### Task 2: 创建 .env 文件

**Files:**
- Create: `.env`

- [ ] **Step 1: 创建 .env 文件**

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=nest_practices
```

- [ ] **Step 2: 确认 .env 已被 gitignored**

```bash
git status
```

Expected: `.env` 不出现在 untracked files 中（`.gitignore` 第 40 行已配置）

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-07-18-mysql-connection.md
git commit -m "chore: 添加 MySQL 连接环境变量模板"
```

---

### Task 3: 配置 TypeORM 到 AppModule

**Files:**
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `ConfigModule` (from `@nestjs/config`), `TypeOrmModule` (from `@nestjs/typeorm`)
- Produces: TypeORM 数据库连接在应用启动时自动建立

- [ ] **Step 1: 修改 app.module.ts**

替换整个文件为：

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
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

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/app.module.ts
git commit -m "feat: 集成 TypeORM + MySQL 数据库连接"
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
