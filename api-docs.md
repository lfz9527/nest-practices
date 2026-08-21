# nest-practices 接口文档

> 前端对接用。Base URL：`http://localhost:3006`
> 初始账号：`1397118980@qq.com / 123456`

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
| email | string | 是 | 登录邮箱，须为邮箱格式 |
| password | string | 是 | 登录密码 |
| captchaId | string | 是 | 验证码标识，来自 `GET /auth/captcha` |
| captchaCode | string | 是 | 验证码内容（4 位数字） |

**请求示例：**

```json
{
  "email": "1397118980@qq.com",
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

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "nickname": "admin",
      "email": "1397118980@qq.com",
      "gender": 0,
      "avatar": "",
      "status": 0,
      "lastLoginTime": "2026-08-22T06:00:00.000Z"
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
| 参数不合法 | `{ "code": -1, "message": "邮箱格式不正确", "data": null }` |

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
| data.createdAt | string | 注册时间 |
| data.updatedAt | string | 更新时间 |

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "nickname": "admin",
    "email": "1397118980@qq.com",
    "gender": 0,
    "avatar": "",
    "status": 0,
    "lastLoginTime": "2026-08-22T06:00:00.000Z",
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

## 三、备注

- 同一账号可在多个端同时登录，各端会话互不影响。
- 401 只代表当前 token 失效，前端需重新登录当前端。
- 登出只影响当前会话，不会影响其他端会话。
- access_token 有效期 7 天，前端无需关心，只需处理 401。
- 登录前必须先调 `GET /auth/captcha` 获取验证码，验证码一次性、5 分钟有效。
