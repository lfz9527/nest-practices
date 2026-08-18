# nest-practices 接口文档

> 前端对接用。Base URL：`http://localhost:3000`
> 初始账号：`admin@example.com / 123456`

## 一、通用约定

**响应格式**（所有接口统一）：

```json
{ "code": 0, "message": "ok", "data": {} }
```

判断成败只看 `code`，不要依赖 HTTP 状态码：

| code | 含义 | 前端处理 |
|---|---|---|
| 0 | 成功 | 用 `data` |
| -1 | 业务错误（如密码错误） | 用 `message` 提示 |
| 401 | 未登录 / 登录已失效 | **清除登录态，跳登录页** |
| 400 | 参数不合法 | 用 `message` 提示 |
| 500 | 服务器错误 | 提示「服务器开小差了」 |

**鉴权**：登录成功返回 `access_token`，后续请求头带 `Authorization: Bearer <access_token>`。同一账号可在多个端同时登录，各端会话互不影响。
**没有 token 刷新机制**：收到 401 只代表当前 token 失效，当前端需重新登录；其他端会话不受影响。

---

## 二、接口详情

### 模块一：认证（auth）

> 职责：账号登录、退出登录，管理登录态生命周期。
> 接口前缀：`/auth`

#### 1. 登录 `POST /auth/login`（无需鉴权）

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| email | string | 是 | 登录邮箱，须为邮箱格式 |
| password | string | 是 | 登录密码 |

**请求示例：**

```json
{ "email": "admin@example.com", "password": "123456" }
```

**成功响应：**

| 字段 | 类型 | 说明 |
|---|---|---|
| data.access_token | string | 登录凭证，后续请求头携带 |
| data.user.id | number | 用户 ID |
| data.user.nickname | string | 昵称 |
| data.user.email | string | 邮箱 |
| data.user.avatar | string | 头像地址 |
| data.user.status | number | 账号状态：0=正常 1=停用 |

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "nickname": "admin",
      "email": "admin@example.com",
      "avatar": "",
      "status": 0
    }
  }
}
```

**失败响应：**

| 场景 | 示例 |
|---|---|
| 账号或密码错误 | `{ "code": -1, "message": "账号或密码错误", "data": null }` |
| 账号已被停用 | `{ "code": -1, "message": "账号已被停用", "data": null }` |
| 参数不合法 | `{ "code": 400, "message": "邮箱格式不正确", "data": null }` |

#### 2. 登出 `POST /auth/logout`（需鉴权）

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

#### 3. 查询用户 `GET /users/:id`（需鉴权）

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

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "nickname": "admin",
    "email": "admin@example.com",
    "avatar": "",
    "gender": 0,
    "status": 0,
    "lastLoginTime": "2026-08-18T06:00:00.000Z"
  }
}
```

> ⚠️ 响应中还包含 `password`（哈希串）等后端字段，前端勿使用，后端后续移除。

**失败响应：**

| 场景 | 示例 |
|---|---|
| 用户不存在 | `{ "code": -1, "message": "用户 999 不存在", "data": null }` |
| id 非数字 | `{ "code": 400, "message": "Validation failed", "data": null }` |
| 未登录或 token 失效 | `{ "code": 401, "message": "未登录或登录状态过期", "data": null }` |

---

## 三、备注

- 同一账号可在多个端同时登录，各端会话互不影响。
- 401 只代表当前 token 失效，前端需重新登录当前端。
- 登出只影响当前会话，不会影响其他端会话。
- access_token 有效期 7 天，前端无需关心，只需处理 401。
