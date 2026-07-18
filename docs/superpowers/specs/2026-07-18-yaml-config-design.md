# 配置项迁移 YAML 设计

**日期**: 2026-07-18
**状态**: 已确认

## 概述

将配置管理从 `.env` 文件迁移为 YAML 文件，通过 `NODE_ENV` 环境变量区分开发/生产环境。

## 方案选择

选择**方案一（保留 @nestjs/config + js-yaml 自定义 loader）**，改动面最小，与现有 TypeORM 配置兼容。

## 技术选型

| 组件 | 选型 |
|---|---|
| 配置加载 | `@nestjs/config` ConfigModule |
| YAML 解析 | `js-yaml` |
| 环境区分 | `NODE_ENV` 环境变量 |

## 新增依赖

```bash
pnpm add js-yaml
pnpm add -D @types/js-yaml
```

## 文件变更

### 新增: `config.dev.yaml`

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

### 新增: `config.prod.yaml`

结构同 `config.dev.yaml`，值按生产环境填写。初始内容相同，部署时由运维替换。

### 新增: `src/config/configuration.ts`

```typescript
import { readFileSync } from 'fs'
import { load } from 'js-yaml'
import { resolve } from 'path'

export default () => {
  const env = process.env.NODE_ENV ?? 'dev'
  return load(readFileSync(resolve(`config.${env}.yaml`), 'utf8'))
}
```

### 修改: `src/app.module.ts`

- `ConfigModule.forRoot()` → `ConfigModule.forRoot({ load: [configuration], ignoreEnvFile: true })`
- TypeORM 的 ConfigService key 从平铺变为嵌套：`DB_HOST` → `database.host` 等

### 修改: `src/main.ts`

- `process.env.PORT ?? 3000` → `configService.get<number>('port') ?? 3000`

### 删除: `.env`

## 不在范围内

- 不添加配置校验（Joi/Zod）
- 不添加配置热重载
- 不修改 `nest_sys.sql`（数据库名不变）

## 注意事项

- YAML 文件提交到仓库，`config.prod.yaml` 初始值与 dev 相同，生产部署时覆盖
- `NODE_ENV` 默认值 `dev`，确保不设环境变量时也能正常启动
- 密码字段在 YAML 中为明文（开发环境），生产环境由运维配置真实密码
