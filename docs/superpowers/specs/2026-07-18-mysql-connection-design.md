# MySQL 连接基础设施设计

**日期**: 2026-07-18
**状态**: 已确认

## 概述

为 NestJS 项目搭建 MySQL 数据库连接基础设施，使用 TypeORM + ConfigModule，采用最小化内联配置方案。

## 方案选择

选择**方案一（最小化内联配置）**：在 `AppModule` 中直接配置 TypeORM，不创建独立 DatabaseModule。后续项目规模增长时可重构为独立模块。

## 技术选型

| 组件 | 选型 |
|---|---|
| ORM 框架 | TypeORM |
| NestJS 集成 | `@nestjs/typeorm` |
| MySQL 驱动 | `mysql2` |
| 配置管理 | `@nestjs/config` (ConfigModule) |

## 新增依赖

```bash
pnpm add @nestjs/config @nestjs/typeorm typeorm mysql2
```

## 环境变量

新增 `.env` 文件：

```
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=nest_practices
```

## 代码变更

### `src/app.module.ts`

在 imports 中添加 `ConfigModule.forRoot()` 和 `TypeOrmModule.forRootAsync()`，通过 ConfigService 读取数据库配置：

- `type: 'mysql'`
- `autoLoadEntities: true` — 自动加载 Entity 类
- `synchronize: true` — 开发阶段自动同步表结构，**生产环境必须关闭**
- 连接参数全部从环境变量读取，无硬编码

## 错误处理

- 数据库连接失败时 TypeORM 会抛出异常，阻止应用启动 — 这是合理的 fail-fast 行为
- 不额外添加重试逻辑（当前无可靠性需求支撑）

## 不在范围内

- 不创建具体 Entity / 业务表
- 不配置 Migration
- 不添加数据库健康检查
- 不做连接池调参（使用 TypeORM 默认值：10 个连接）

## 注意事项

- `synchronize: true` 仅在开发阶段使用，上生产前需改为 `false` 并启用 Migration
- `.env` 文件需确保在 `.gitignore` 中
