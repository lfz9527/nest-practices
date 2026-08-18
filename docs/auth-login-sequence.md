# 认证登录时序图（JWT + Redis 多端会话）

> 对应认证方案：登录签发 access token（有效期 7 天，payload 含 sessionId 和 jti），每个会话的 jti 存 Redis。
> 同一账号可在多个端同时登录，无 refresh 机制；401 只代表当前 token 失效，登出只影响当前会话。
> 日期：2026-08-18

## 1. 登录

```mermaid
sequenceDiagram
    participant C as 前端
    participant AC as AuthController
    participant AS as AuthService
    participant DB as MySQL
    participant RD as Redis

    C->>AC: POST /auth/login { email, password }
    AC->>AS: login(dto, ip)
    AS->>DB: findOne(email, delFlag=0)
    DB-->>AS: user
    AS->>AS: bcrypt.compare(password)
    alt 校验失败（用户不存在 / 密码错误 / 账号停用）
        AS-->>C: 业务错误（账号或密码错误 / 账号已被停用）
    else 通过
        AS->>AS: 服务端生成 sessionId、jti
        AS->>AS: 签发 access token { sub, email, sessionId, jti, type:'access' }（7 天）
        AS->>RD: SET auth:session:{userId}:{sessionId} = jti EX 604800（各会话独立）
        AS->>DB: update lastLoginIp / lastLoginTime
        AC-->>C: { access_token, user }
    end
```

## 2. 请求鉴权（每个业务请求）

```mermaid
sequenceDiagram
    participant C as 前端
    participant G as JwtAuthGuard
    participant S as JwtStrategy
    participant RD as Redis
    participant CTRL as 业务控制器

    C->>G: GET /users/:id + Authorization: Bearer <access>
    G->>S: 验签（HS256、有效期、type='access'）
    S->>RD: GET auth:session:{userId}:{sessionId}
    RD-->>S: 当前 sessionId 对应的 jti
    alt 签名有效 且 jti 与当前会话 Redis 值一致
        S-->>G: 放行（req.user = payload）
        G->>CTRL: 执行业务
        CTRL-->>C: 业务数据
    else token 过期/无效，或当前会话 jti 不一致（已登出）
        G-->>C: 401「未登录或登录状态过期」→ 当前端重新登录
    end
```

## 3. 登出（即时失效）

```mermaid
sequenceDiagram
    participant C as 前端
    participant G as JwtAuthGuard
    participant AC as AuthController
    participant AS as AuthService
    participant RD as Redis

    C->>G: POST /auth/logout + Authorization: Bearer（守卫校验通过）
    G->>AC: req.user = { sub, sessionId }
    AC->>AS: logout(userId, sessionId)
    AS->>RD: DEL auth:session:{userId}:{sessionId}
    AC-->>C: { message: '已退出登录' }
    Note over C,RD: 此后该 token 再请求 → 当前会话 Redis 无 jti → 401；其他会话继续有效
```

## 关键语义

- **多端登录**：服务端为每次登录生成 sessionId，Redis 按 `auth:session:{userId}:{sessionId}` 保存各会话 jti，同一账号的多个会话互不覆盖
- **请求鉴权**：从 token 的 sessionId 定位对应 Redis 会话，签名、有效期、type 和 jti 均校验通过才放行
- **登出**：只删除当前会话 Redis key，该 token 立即失效，其他会话继续有效
- **过期**：7 天后 token 签名过期 → 验签失败 → 401
- **无 refresh**：401 只代表当前 token 失效，当前端重新登录
