# nest-practices 接口文档

> 前端对接用。Base URL：`http://localhost:3006`
> 初始账号：`123456@qq.com / 123456`

## 一、通用约定

**响应格式**（所有接口统一）：

```json
{ "code": 0, "message": "ok", "data": {} }
```

判断成败只看 `code`，不要依赖 HTTP 状态码：

| code | 含义 | 前端处理 |
|---|---|---|
| 0 | 成功 | 用 `data` |
| -1 | 业务错误（如密码错误、参数不合法） | 用 `message` 提示 |
| 401 | 未登录 / 登录已失效 | **清除登录态，跳登录页** |
| 500 | 服务器错误 | 提示「服务器开小差了」 |

**鉴权**：登录成功返回 `access_token`，后续请求头带 `Authorization: Bearer <access_token>`。同一账号可在多个端同时登录，各端会话互不影响。
**没有 token 刷新机制**：收到 401 只代表当前 token 失效，当前端需重新登录；其他端会话不受影响。

---

## 二、接口详情

### 模块一：认证（auth）

> 职责：获取验证码、账号登录、退出登录，管理登录态生命周期。
> 接口前缀：`/auth`

#### 1. 获取验证码 `GET /auth/captcha`（无需鉴权）

**请求参数：** 无

**成功响应：**

| 字段 | 类型 | 说明 |
|---|---|---|
| data.captchaId | string | 验证码标识，登录时原样传回 |
| data.image | string | 验证码图片（SVG base64），直接用于 `<img src>`，内容为 4 位数字 |

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "captchaId": "1a2b3c4d-1111-2222-3333-444455556666",
    "image": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0..."
  }
}
```

> 验证码一次性，登录成功后立即失效；5 分钟未使用自动过期；校验不区分大小写。

**失败响应：** 无（不会失败）

#### 2. 登录 `POST /auth/login`（无需鉴权）

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| email | string | 是 | 登录邮箱 |
| password | string | 是 | 登录密码 |
| captchaId | string | 是 | 验证码标识，来自 `GET /auth/captcha` |
| captchaCode | string | 是 | 验证码内容（4 位数字） |

**请求示例：**

```json
{
  "email": "123456@qq.com",
  "password": "123456",
  "captchaId": "1a2b3c4d-1111-2222-3333-444455556666",
  "captchaCode": "1234"
}
```

**成功响应：**

| 字段 | 类型 | 说明 |
|---|---|---|
| data.access_token | string | 登录凭证，后续请求头携带 |
| data.user.id | number | 用户 ID |
| data.user.nickname | string | 昵称 |
| data.user.email | string | 邮箱 |
| data.user.avatar | string | 头像地址 |
| data.user.gender | number | 性别：0=男 1=女 2=未知 |
| data.user.status | number | 账号状态：0=正常 1=停用 |
| data.user.lastLoginTime | string \| null | 最近登录时间 |
| data.user.roleId | number \| null | 角色 ID，未分配角色为 null |
| data.user.role | object \| null | 角色信息 `{ id, name, roleKey }`，未分配角色为 null |

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "nickname": "admin",
      "email": "123456@qq.com",
      "gender": 0,
      "avatar": "",
      "status": 0,
      "lastLoginTime": "2026-08-22T06:00:00.000Z",
      "roleId": 1,
      "role": { "id": 1, "name": "管理员", "roleKey": "admin" }
    }
  }
}
```

**失败响应：**

| 场景 | 示例 |
|---|---|
| 验证码错误或已过期 | `{ "code": -1, "message": "验证码错误或已过期", "data": null }` |
| 账号或密码错误 | `{ "code": -1, "message": "账号或密码错误", "data": null }` |
| 账号已被停用 | `{ "code": -1, "message": "账号已被停用", "data": null }` |
| 参数不合法 | `{ "code": -1, "message": "密码不能为空", "data": null }` |

#### 3. 登出 `POST /auth/logout`（需鉴权）

**请求参数：** 无

**成功响应：**

```json
{ "code": 0, "message": "ok", "data": { "message": "已退出登录" } }
```

**失败响应：**

| 场景 | 示例 |
|---|---|
| 未登录或 token 失效 | `{ "code": 401, "message": "未登录或登录状态过期", "data": null }` |

> 登出只影响当前登录会话，不会使同一账号在其他端的会话失效。

---

### 模块二：用户（users）

> 职责：用户信息查询。
> 接口前缀：`/users`

#### 4. 查询用户 `GET /users/:id`（需鉴权）

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id（路径参数） | number | 是 | 用户 ID，非数字返回 400 |

**成功响应：**

| 字段 | 类型 | 说明 |
|---|---|---|
| data.id | number | 用户 ID |
| data.nickname | string | 昵称 |
| data.email | string | 邮箱 |
| data.avatar | string | 头像地址 |
| data.gender | number | 性别：0=男 1=女 2=未知 |
| data.status | number | 账号状态：0=正常 1=停用 |
| data.lastLoginTime | string \| null | 最近登录时间 |
| data.roleId | number \| null | 角色 ID，未分配角色为 null |
| data.role | object \| null | 角色信息 `{ id, name, roleKey }`，未分配角色为 null |
| data.createdAt | string | 注册时间 |
| data.updatedAt | string | 更新时间 |

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "nickname": "admin",
    "email": "123456@qq.com",
    "gender": 0,
    "avatar": "",
    "status": 0,
    "lastLoginTime": "2026-08-22T06:00:00.000Z",
    "roleId": 1,
    "role": { "id": 1, "name": "管理员", "roleKey": "admin" },
    "createdAt": "2026-08-01T06:00:00.000Z",
    "updatedAt": "2026-08-22T06:00:00.000Z"
  }
}
```

> ⚠️ 响应中还包含 `password`（哈希串）等后端字段，前端勿使用，后端后续移除。

**失败响应：**

| 场景 | 示例 |
|---|---|
| 用户不存在 | `{ "code": -1, "message": "用户 999 不存在", "data": null }` |
| id 非数字 | `{ "code": -1, "message": "Validation failed (numeric string is expected)", "data": null }` |
| 未登录或 token 失效 | `{ "code": 401, "message": "未登录或登录状态过期", "data": null }` |

---

### 模块三：邮件（mail）

> 职责：发送纯文本邮件。
> 接口前缀：`/mail`

#### 5. 发送邮件 `POST /mail/send`（需鉴权）

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| to | string | 是 | 收件人邮箱，须为邮箱格式 |
| subject | string | 是 | 邮件主题，最长 200 字符 |
| text | string | 是 | 邮件正文，最长 10000 字符 |

**请求示例：**

```json
{
  "to": "user@example.com",
  "subject": "注册验证",
  "text": "您的验证码是 123456"
}
```

**成功响应：**

```json
{ "code": 0, "message": "ok", "data": { "message": "邮件发送成功" } }
```

**失败响应：**

| 场景 | 示例 |
|---|---|
| 邮件服务未配置 | `{ "code": -1, "message": "邮件服务未配置", "data": null }` |
| 邮件发送失败 | `{ "code": -1, "message": "邮件发送失败", "data": null }` |
| 参数不合法 | `{ "code": -1, "message": "收件人邮箱格式不正确", "data": null }` |
| 未登录或 token 失效 | `{ "code": 401, "message": "未登录或登录状态过期", "data": null }` |

---

### 模块四：健康检查（/）

> 职责：服务存活与依赖（Redis、数据库）状态探测，运维用途，前端一般不调用。
> 接口前缀：无（根路径）

#### 6. 健康检查 `GET /health`（无需鉴权）

**请求参数：** 无

**成功响应：**

| 字段 | 类型 | 说明 |
|---|---|---|
| data.status | string | 整体状态，`ok` 表示正常 |
| data.info.redis | object | Redis 状态（up 表示正常） |
| data.info.database | object | 数据库状态（up 表示正常） |

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "status": "ok",
    "info": {
      "redis": { "status": "up" },
      "database": { "status": "up" }
    },
    "error": {},
    "details": {
      "redis": { "status": "up" },
      "database": { "status": "up" }
    }
  }
}
```

**失败响应：**

| 场景 | 示例 |
|---|---|
| Redis 或数据库不可用（HTTP 503） | `{ "code": 503, "message": "Service Unavailable", "data": { "status": "error", "info": {}, "error": {}, "details": { "redis": { "status": "down" } } } }` |

> 此接口失败时 HTTP 状态码为 503，且 `data` 中带有各依赖的详细状态，是唯一成功/失败都不走 `data: null` 约定的接口。

---

### 模块五：角色（roles）

> 职责：角色管理。用户与角色一对多关联（一个用户一个角色），角色信息会随登录/用户查询返回。
> 接口前缀：`/roles`
> 说明：受网关限制，本模块接口仅使用 GET/POST 方法，更新/删除通过 POST 路径实现。

#### 7. 角色分页列表 `GET /roles`（需鉴权）

**请求参数：**（Query）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | number | 否 | 页码，默认 1，最小 1 |
| pageSize | number | 否 | 每页条数，默认 10，1-100 |
| name | string | 否 | 按角色名称模糊筛选 |
| status | number | 否 | 按状态筛选：0=正常 1=停用 |

**成功响应：**

| 字段 | 类型 | 说明 |
|---|---|---|
| data.list[].id | number | 角色 ID |
| data.list[].name | string | 角色名称 |
| data.list[].roleKey | string | 角色编码（唯一，如 admin） |
| data.list[].status | number | 状态：0=正常 1=停用 |
| data.list[].sort | number | 显示顺序（升序排列） |
| data.list[].remark | string | 备注 |
| data.list[].createdAt | string | 创建时间 |
| data.list[].updatedAt | string | 更新时间 |
| data.total | number | 总条数 |

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "id": 1,
        "name": "管理员",
        "roleKey": "admin",
        "status": 0,
        "sort": 0,
        "remark": "",
        "createdAt": "2026-08-22T00:00:00.000Z",
        "updatedAt": "2026-08-22T00:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

**失败响应：**

| 场景 | 示例 |
|---|---|
| 未登录或 token 失效 | `{ "code": 401, "message": "未登录或登录状态过期", "data": null }` |
| 参数不合法 | `{ "code": -1, "message": "每页条数最大为 100", "data": null }` |

#### 8. 角色详情 `GET /roles/:id`（需鉴权）

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id（路径参数） | number | 是 | 角色 ID，非数字返回 400 |

**成功响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "name": "管理员",
    "roleKey": "admin",
    "status": 0,
    "sort": 0,
    "remark": "",
    "createdAt": "2026-08-22T00:00:00.000Z",
    "updatedAt": "2026-08-22T00:00:00.000Z"
  }
}
```

**失败响应：**

| 场景 | 示例 |
|---|---|
| 角色不存在 | `{ "code": -1, "message": "角色 999 不存在", "data": null }` |
| 未登录或 token 失效 | `{ "code": 401, "message": "未登录或登录状态过期", "data": null }` |

#### 9. 创建角色 `POST /roles`（需鉴权）

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 角色名称，1-30 字符 |
| roleKey | string | 是 | 角色编码，1-50 字符，唯一（含已删除角色） |
| status | number | 否 | 状态：0=正常 1=停用，默认 0 |
| sort | number | 否 | 显示顺序，默认 0 |
| remark | string | 否 | 备注，最长 255 字符，默认 '' |

**请求示例：**

```json
{
  "name": "运营",
  "roleKey": "operator",
  "status": 0,
  "sort": 1,
  "remark": "内容运营"
}
```

**成功响应：**

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 2,
    "name": "运营",
    "roleKey": "operator",
    "status": 0,
    "sort": 1,
    "remark": "内容运营",
    "createdAt": "2026-08-22T00:00:00.000Z",
    "updatedAt": "2026-08-22T00:00:00.000Z"
  }
}
```

**失败响应：**

| 场景 | 示例 |
|---|---|
| 角色编码已存在 | `{ "code": -1, "message": "角色编码 operator 已存在", "data": null }` |
| 参数不合法 | `{ "code": -1, "message": "角色名称不能为空", "data": null }` |
| 未登录或 token 失效 | `{ "code": 401, "message": "未登录或登录状态过期", "data": null }` |

#### 10. 更新角色 `POST /roles/update`（需鉴权）

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | number | 是 | 角色 ID |
| name | string | 是 | 角色名称，1-30 字符 |
| status | number | 否 | 状态：0=正常 1=停用，不传保留原值 |
| sort | number | 否 | 显示顺序，不传保留原值 |
| remark | string | 否 | 备注，最长 255 字符，不传保留原值 |

> `roleKey` 创建后不可修改。

**请求示例：**

```json
{
  "id": 2,
  "name": "运营专员",
  "status": 0,
  "sort": 2,
  "remark": ""
}
```

**成功响应：** 更新后的角色对象（同详情接口结构）

**失败响应：**

| 场景 | 示例 |
|---|---|
| 角色不存在 | `{ "code": -1, "message": "角色 999 不存在", "data": null }` |
| 参数不合法 | `{ "code": -1, "message": "角色名称不能为空", "data": null }` |
| 未登录或 token 失效 | `{ "code": 401, "message": "未登录或登录状态过期", "data": null }` |

#### 11. 删除角色 `POST /roles/delete`（需鉴权）

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | number | 是 | 角色 ID |

**请求示例：**

```json
{ "id": 2 }
```

**成功响应：**

```json
{ "code": 0, "message": "ok", "data": null }
```

> 删除为软删除；该角色关联的用户会变为无角色（后续登录/用户查询返回 `role: null`），用户本身不受影响。

**失败响应：**

| 场景 | 示例 |
|---|---|
| 角色不存在 | `{ "code": -1, "message": "角色 999 不存在", "data": null }` |
| 未登录或 token 失效 | `{ "code": 401, "message": "未登录或登录状态过期", "data": null }` |

---

## 三、备注

- 同一账号可在多个端同时登录，各端会话互不影响。
- 401 只代表当前 token 失效，前端需重新登录当前端。
- 登出只影响当前会话，不会影响其他端会话。
- access_token 有效期 7 天，前端无需关心，只需处理 401。
- 登录前必须先调 `GET /auth/captcha` 获取验证码，验证码一次性、5 分钟有效。
- 角色编码（roleKey）创建后不可修改；删除角色后其关联用户的 `role` 变为 null。
