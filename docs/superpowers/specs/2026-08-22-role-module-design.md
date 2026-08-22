# 角色模块设计文档

日期：2026-08-22
状态：已确认

## 背景

项目（NestJS 11 + TypeORM + MySQL）目前只有用户与认证模块，用户无角色概念。本次新增角色模块，用户与角色一对多关联（一个用户一个角色），登录与用户查询接口返回角色信息。

## 需求确认

- 模块深度：角色**完整增删改查** + 用户关联（一对多，`users.roleId`）
- 接口范围：**HTTP 方法只允许 GET、POST**（受网关/客户端约束）——更新用 `POST /roles/update`、删除用 `POST /roles/delete` 实现，功能不缩减
- 返回角色：登录接口与 `GET /users/:id` 均返回角色对象
- 删除策略：允许删除，删除时把关联用户的 `roleId` 置空
- 实现方案：独立 `roles` 模块 + 轻改 `users`/`auth` 模块

## 数据库设计

### 新增 `roles` 表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigint unsigned PK 自增 | 主键 |
| name | varchar(30) | 角色名称 |
| roleKey | varchar(50) | 角色编码（如 admin），唯一 |
| status | tinyint 默认 0 | 0=正常 1=停用 |
| sort | int 默认 0 | 显示顺序 |
| remark | varchar(255) 默认 '' | 备注 |
| delFlag | tinyint 默认 0，索引 | 0=存在 2=删除 |
| createdAt / updatedAt | datetime | 自动维护 |

- 唯一约束 `(roleKey, delFlag)`，与 users 的 `(email, delFlag)` 风格一致
- 软删除沿用 `delFlag` 约定

### `users` 表变更

新增列：`roleId bigint unsigned NULL`。无数据库外键，仅逻辑关联（与项目现有风格一致）。

## 接口设计

统一响应契约：成功 `{ code: 0, message: 'ok', data }`；业务错误 HTTP 200 + `{ code: -1, message, data: null }`。全部接口需登录（全局 `JwtAuthGuard`，`Authorization: Bearer <access>`）。

### 角色接口（`/roles`，方法仅 GET/POST）

#### GET /roles —— 分页列表

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |
| name | string | 否 | 按角色名称模糊筛选 |
| status | number | 否 | 按状态筛选（0/1） |

响应 `data`：`{ list: Role[], total: number }`（过滤 `delFlag = 0`，按 sort 升序、id 降序）。

#### GET /roles/:id —— 详情

路径参数 `id`（`ParseIntPipe`，非数字按业务错误返回）。角色不存在抛 `AppError(BIZ_ERROR, '角色 xxx 不存在')`。

#### POST /roles —— 创建

Body（class-validator 中文校验消息）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 角色名称，1-30 字符 |
| roleKey | string | 是 | 角色编码，1-50 字符，唯一（存在校验） |
| status | number | 否 | 默认 0 |
| sort | number | 否 | 默认 0 |
| remark | string | 否 | 默认 '' |

roleKey 已存在（含软删除数据）抛 `AppError(BIZ_ERROR, '角色编码 xxx 已存在')`。

#### POST /roles/update —— 更新

Body：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | number | 是 | 角色 id |
| name | string | 是 | 角色名称，1-30 字符 |
| status | number | 否 | 0/1 |
| sort | number | 否 | 显示顺序 |
| remark | string | 否 | 备注 |

- `roleKey` 不可修改（角色编码创建后固定）
- 角色不存在抛 `AppError(BIZ_ERROR, '角色 xxx 不存在')`

#### POST /roles/delete —— 删除

Body：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | number | 是 | 角色 id |

- 软删除：`delFlag = 2`
- 同时将 `users` 表中 `roleId = id` 的用户 `roleId` 置空（`null`）
- 角色不存在抛 `AppError(BIZ_ERROR, '角色 xxx 不存在')`

### 登录返回角色

`POST /auth/login` 响应 `user` 对象附加 `role` 字段（null 或 `{ id, name, roleKey }`），由 auth 服务关联查询。

### 用户查询返回角色

`GET /users/:id` 返回 `role` 字段（同上），由 users 服务关联查询。

## 代码结构

```
src/roles/
├── role.entity.ts          # Role 实体
├── roles.service.ts        # 分页/详情/创建/更新/删除（删除含置空用户引用）
├── roles.controller.ts     # GET /roles、GET /roles/:id、POST /roles、POST /roles/update、POST /roles/delete
├── roles.module.ts         # TypeOrmModule.forFeature([Role, User])（删除需操作 User 表）
├── dto/
│   ├── query-roles.dto.ts    # 分页查询参数（Transform 数字化）
│   ├── create-role.dto.ts    # 创建参数
│   ├── update-role.dto.ts    # 更新参数（id + name/status/sort/remark）
│   └── delete-role.dto.ts    # 删除参数（id）
├── roles.service.spec.ts
└── roles.e2e-spec.ts
```

- users 模块：`User` 实体加 `roleId` 字段；`users.service` 的 `findById` 关联查询角色附加 `role` 字段；`UsersModule` 的 `TypeOrmModule.forFeature([User, Role])` 引入 Role 实体（Role 仓库仅在本模块内使用）
- auth 模块：`auth.service.login` 关联查询角色附加 `role` 字段；`AuthModule` 同理 `forFeature([User, Role])`

## 错误处理

- 统一 `AppError` + `ErrorCodes.BIZ_ERROR`（-1），不新增错误码
- 校验异常由现有 `ValidationPipe`/`ParseIntPipe` 统一转业务错误形态（HTTP 200 + code -1）

## 测试

- 单元测试：`roles.service.spec.ts`（分页、详情不存在、创建成功、roleKey 重复、更新成功、更新不存在、删除成功且用户引用置空、删除不存在）、`users.service.spec.ts` 补充角色关联、`auth.service.spec.ts` 补充登录返回角色
- E2E：`roles.e2e-spec.ts`（未登录 401、分页列表、详情、创建成功、roleKey 重复、更新、删除、参数校验失败）

## 非目标

- 不做权限/菜单模块（后续可扩展）
- 不做用户-角色多对多（后续需要时再引入中间表）
