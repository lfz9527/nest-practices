# 认证登录模块实现计划（JWT access + refresh / Redis）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 NestJS 项目中实现认证登录模块：登录签发 access + refresh 双 token，refresh 存 Redis（单端顶号、可轮换、可主动失效），全局 JwtAuthGuard 保护接口。

**Architecture:** 重建 `src/auth/`（AuthService 业务逻辑、JwtStrategy 无状态验证 access、JwtAuthGuard 全局守卫 + `@Public()` 放行、AuthController 提供 login/refresh/logout）；新增 `src/redis/`（RedisModule 全局模块 + RedisService 封装 ioredis）；config.yaml 扩展 `redis` 段与 `jwt` 双有效期；开发环境经 WSL Redis + Windows netsh portproxy 打通。

**Tech Stack:** NestJS 11、TypeORM（User 实体复用）、ioredis、@nestjs/jwt + passport-jwt、bcryptjs、cookie-parser、supertest（E2E）、jest（单测）。

## Global Constraints

- 代码风格：无分号（`semi: false`）、单引号、尾逗号、LF 换行（遵守 Prettier 配置）
- 错误模型：一律 `AppError`（`src/common/errors/app-error.ts`），业务错误用 `ErrorCodes.BIZ_ERROR`，401 用 `ErrorCodes.UNAUTHORIZED`
- 校验消息一律中文；`ValidationPipe({ whitelist: true })` 已在 main.ts 全局启用
- 响应契约由 `TransformInterceptor` 统一包裹 `{ code: 0, message: 'ok', data }`
- 测试：单测 `*.spec.ts` 与被测文件同目录；E2E `*.e2e-spec.ts`（`test/jest-e2e.json` 的 `testRegex` 匹配）；E2E 遵循项目现有 mock 风格（参照 `src/users/users.e2e-spec.ts`）
- commit 格式 `<type>: <subject>`（type ∈ feat/fix/docs/...）；husky pre-commit 运行 `npm test`
- 包管理用 pnpm；Node 24；TypeScript 5.7 / NodeNext 模块解析
- `docs/` 被 .gitignore 忽略：设计文档与计划文档只存本地，不提交

---

### Task 1: 依赖安装与 config.yaml 扩展

**Files:**
- Modify: `package.json`（pnpm add 自动更新）
- Modify: `config.yaml`

**Interfaces:**
- Consumes: 无
- Produces: `config.yaml` 提供 `redis.host/port/password`、`jwt.secret/accessExpiresIn/refreshExpiresIn`，供 Task 3（RedisService）、Task 4（AuthService）、Task 5（JwtStrategy）、Task 6（AuthController）通过 `ConfigService` 读取

- [ ] **Step 1: 安装依赖**

```bash
pnpm add ioredis cookie-parser
pnpm add -D @types/cookie-parser
```

Expected: `package.json` dependencies 增加 `ioredis`、`cookie-parser`；devDependencies 增加 `@types/cookie-parser`。

- [ ] **Step 2: 扩展 config.yaml**

在 `config.yaml` 的 `logger` 段之后、`jwt` 段之前插入 Redis 配置，并改造 jwt 段：

```yaml
# Redis 连接（开发环境：WSL 内 Redis，经 portproxy 转发到本机 6379）
redis:
  host: 127.0.0.1
  port: 6379
  password: 'root'

# JWT 配置
jwt:
  # 签名密钥（生产环境应通过环境变量注入，勿硬编码）
  secret: 'nest-practices-secret-key'
  # access token 有效期（单位：秒）
  accessExpiresIn: 1800
  # refresh token 有效期（单位：秒）
  refreshExpiresIn: 604800
```

替换原 `jwt` 段（原 `expiresIn` 删除，拆为 `accessExpiresIn` + `refreshExpiresIn`）。

- [ ] **Step 3: 验证构建**

Run: `pnpm build`
Expected: 构建成功，无 TS 错误。

- [ ] **Step 4: Commit**

```bash
git add config.yaml package.json pnpm-lock.yaml
git commit -m "feat: 引入 ioredis 与 cookie-parser 依赖，配置项扩展 redis 段与 jwt 双有效期"
```

---

### Task 2: Redis 开发环境打通（WSL Redis + portproxy）

**Files:**
- Create: `scripts/redis-link.sh`
- Modify: `package.json`（新增 `redis:link` 脚本）

**Interfaces:**
- Consumes: WSL2 内已运行的 Redis 8.0.5（密码 `root`）
- Produces: Windows 侧 `127.0.0.1:6379` 可访问 WSL 内 Redis（供 Task 8 手动验证与日常开发使用）；`pnpm redis:link` 命令

- [ ] **Step 1: 修改 WSL 内 Redis 监听地址为 0.0.0.0**

WSL 内 Redis 默认只监听 `127.0.0.1`，Windows 无法经 NAT 访问。需改为监听全部网卡（Redis 已有 requirepass=root，仅开发环境可接受）：

```bash
wsl -e bash -lc "sudo bash -c \"grep -n '^bind' /etc/redis/redis.conf\""
```

Expected: 输出当前 bind 行（如 `bind 127.0.0.1 -::1`），确认存在。

```bash
wsl -e bash -lc "sudo bash -c \"sed -i 's/^bind .*/bind 0.0.0.0/' /etc/redis/redis.conf && service redis-server restart && redis-cli -a root --no-auth-warning ping\""
```

Expected: 输出 `PONG`，且 `ss -tln | grep 6379` 显示监听 `0.0.0.0:6379`。

- [ ] **Step 2: 编写端口转发脚本**

创建 `scripts/redis-link.sh`：

```bash
#!/usr/bin/env bash
# 将 WSL 内 Redis 转发到 Windows 127.0.0.1:6379（需管理员权限运行）
# WSL 每次重启后 IP 会变化，重跑本脚本即可

set -e

WSLIP=$(wsl hostname -I | tr -d ' ' | awk '{print $1}')
if [ -z "$WSLIP" ]; then
  echo "无法获取 WSL IP，请确认 WSL 已启动" >&2
  exit 1
fi

netsh interface portproxy delete v4tov4 listenaddress=127.0.0.1 listenport=6379 2>/dev/null || true
netsh interface portproxy add v4tov4 listenaddress=127.0.0.1 listenport=6379 connectaddress="$WSLIP" connectport=6379
echo "portproxy 已配置: 127.0.0.1:6379 -> $WSLIP:6379"
```

- [ ] **Step 3: 注册 pnpm 脚本**

在 `package.json` scripts 增加：

```json
"redis:link": "bash scripts/redis-link.sh"
```

- [ ] **Step 4: 运行脚本并验证连接**

以管理员身份运行（Git Bash 右键"以管理员身份运行"，再进入项目目录），然后：

```bash
pnpm redis:link
```

Expected: 输出 `portproxy 已配置: 127.0.0.1:6379 -> <WSL_IP>:6379`。

Windows 侧验证（管理员窗口或普通窗口均可验证连接）：

```bash
node -e "const net=require('net');const s=net.connect(6379,'127.0.0.1',()=>s.write('AUTH root\r\n'));s.on('data',d=>{console.log(d.toString().includes('+OK')?'Redis OK':'FAIL '+d);process.exit(0)});s.on('error',e=>{console.log('FAIL',e.message);process.exit(1)});setTimeout(()=>{console.log('TIMEOUT');process.exit(1)},4000)"
```

Expected: 输出 `Redis OK`。

- [ ] **Step 5: Commit**

```bash
git add scripts/redis-link.sh package.json
git commit -m "feat: 新增 redis:link 脚本打通 WSL Redis 与 Windows 端口转发"
```

---

### Task 3: RedisModule + RedisService

**Files:**
- Create: `src/redis/redis.module.ts`
- Create: `src/redis/redis.service.ts`
- Test: `src/redis/redis.service.spec.ts`

**Interfaces:**
- Consumes: `ConfigService`（读 `redis.host/port/password`）
- Produces: 全局可注入的 `RedisService`，方法 `get(key): Promise<string|null>`、`set(key, value, ttlSeconds?)`、`del(key)`；Task 4（AuthService）、Task 7（E2E mock）依赖

- [ ] **Step 1: 写失败测试**

创建 `src/redis/redis.service.spec.ts`：

```typescript
import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { RedisService } from './redis.service'

jest.mock('ioredis')

const mockClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
}

describe('RedisService', () => {
  let service: RedisService
  let client: typeof mockClient

  beforeAll(async () => {
    ;(Redis as jest.Mock).mockImplementation(() => mockClient)
    const moduleRef = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({ 'redis.host': '127.0.0.1', 'redis.port': 6379, 'redis.password': 'root' })[key],
          },
        },
      ],
    }).compile()
    service = moduleRef.get(RedisService)
    client = mockClient
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('get 转发到底层客户端', async () => {
    client.get.mockResolvedValue('v')
    await expect(service.get('k')).resolves.toBe('v')
    expect(client.get).toHaveBeenCalledWith('k')
  })

  it('set 带 TTL 时透传 EX 参数', async () => {
    client.set.mockResolvedValue('OK')
    await service.set('k', 'v', 100)
    expect(client.set).toHaveBeenCalledWith('k', 'v', 'EX', 100)
  })

  it('set 不带 TTL 时不传过期参数', async () => {
    client.set.mockResolvedValue('OK')
    await service.set('k', 'v')
    expect(client.set).toHaveBeenCalledWith('k', 'v')
  })

  it('del 转发到底层客户端', async () => {
    client.del.mockResolvedValue(1)
    await service.del('k')
    expect(client.del).toHaveBeenCalledWith('k')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest src/redis/redis.service.spec.ts`
Expected: FAIL，报 `Cannot find module './redis.service'` 或类型错误。

- [ ] **Step 3: 实现 RedisService**

创建 `src/redis/redis.service.ts`：

```typescript
import { Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly client: Redis

  constructor(configService: ConfigService) {
    this.client = new Redis({
      host: configService.get<string>('redis.host'),
      port: configService.get<number>('redis.port'),
      password: configService.get<string>('redis.password') || undefined,
    })
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, 'EX', ttlSeconds)
    } else {
      await this.client.set(key, value)
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit()
  }
}
```

创建 `src/redis/redis.module.ts`：

```typescript
import { Global, Module } from '@nestjs/common'
import { RedisService } from './redis.service'

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest src/redis/redis.service.spec.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/redis/ package.json
git commit -m "feat: 新增 RedisModule 全局模块与 RedisService 封装"
```

---

### Task 4: AuthService 登录 / 刷新 / 登出 + LoginDto

**Files:**
- Create: `src/auth/dto/login.dto.ts`
- Create: `src/auth/auth.service.ts`
- Test: `src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `User` 实体（`@InjectRepository(User)`）、`JwtService`、`ConfigService`（`jwt.accessExpiresIn/refreshExpiresIn`）、`RedisService`
- Produces: `AuthService.login(loginDto, ip): Promise<{ access_token, refresh_token, user }>`、`AuthService.refresh(refreshToken): Promise<{ access_token, refresh_token }>`、`AuthService.logout(userId): Promise<void>`；导出常量 `REFRESH_KEY_PREFIX = 'auth:refresh:'`；Task 6（AuthController）依赖

- [ ] **Step 1: 写失败测试**

创建 `src/auth/auth.service.spec.ts`：

```typescript
import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { getRepositoryToken } from '@nestjs/typeorm'
import { hash } from 'bcryptjs'
import { User } from '../users/user.entity'
import { RedisService } from '../redis/redis.service'
import { AppError } from '../common/errors/app-error'
import { AuthService, REFRESH_KEY_PREFIX } from './auth.service'

const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}

const jwtMock = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
}

const userRepoMock = {
  findOne: jest.fn(),
  update: jest.fn(),
}

const configMock = {
  get: (key: string) =>
    ({
      'jwt.accessExpiresIn': 1800,
      'jwt.refreshExpiresIn': 604800,
    })[key],
}

describe('AuthService', () => {
  let service: AuthService
  let hashedPassword: string

  beforeAll(async () => {
    hashedPassword = await hash('123456', 10)
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile()
    service = moduleRef.get(AuthService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const buildUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 1,
      nickname: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      status: 0,
      delFlag: 0,
      lastLoginIp: '',
      lastLoginTime: null,
      ...overrides,
    }) as User

  it('登录成功：签发双 token、refresh jti 写入 Redis、更新登录信息', async () => {
    userRepoMock.findOne.mockResolvedValue(buildUser())
    jwtMock.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token')
    redisMock.set.mockResolvedValue(undefined)
    userRepoMock.update.mockResolvedValue({ affected: 1 })

    const result = await service.login(
      { email: 'admin@example.com', password: '123456' },
      '127.0.0.1',
    )

    expect(result.access_token).toBe('access-token')
    expect(result.refresh_token).toBe('refresh-token')
    expect(result.user).not.toHaveProperty('password')
    expect(redisMock.set).toHaveBeenCalledWith(
      `${REFRESH_KEY_PREFIX}1`,
      expect.any(String),
      604800,
    )
    expect(userRepoMock.update).toHaveBeenCalledWith(1, {
      lastLoginIp: '127.0.0.1',
      lastLoginTime: expect.any(Date),
    })
  })

  it('登录失败：邮箱不存在抛 BIZ_ERROR 且文案不暴露账号状态', async () => {
    userRepoMock.findOne.mockResolvedValue(null)
    await expect(
      service.login({ email: 'x@y.com', password: '123456' }, ''),
    ).rejects.toMatchObject({ code: -1, message: '账号或密码错误' })
    expect(redisMock.set).not.toHaveBeenCalled()
  })

  it('登录失败：密码错误', async () => {
    userRepoMock.findOne.mockResolvedValue(buildUser())
    await expect(
      service.login({ email: 'admin@example.com', password: 'wrong' }, ''),
    ).rejects.toMatchObject({ code: -1, message: '账号或密码错误' })
  })

  it('登录失败：账号停用', async () => {
    userRepoMock.findOne.mockResolvedValue(buildUser({ status: 1 }))
    await expect(
      service.login({ email: 'admin@example.com', password: '123456' }, ''),
    ).rejects.toMatchObject({ code: -1, message: '账号已被停用' })
  })

  it('刷新成功：jti 一致则轮换并签发新双 token', async () => {
    jwtMock.verifyAsync.mockResolvedValue({ sub: 1, jti: 'jti-1' })
    redisMock.get.mockResolvedValue('jti-1')
    jwtMock.signAsync.mockResolvedValueOnce('new-access').mockResolvedValueOnce('new-refresh')
    redisMock.set.mockResolvedValue(undefined)

    const result = await service.refresh('refresh-token')

    expect(result).toEqual({ access_token: 'new-access', refresh_token: 'new-refresh' })
    expect(redisMock.del).toHaveBeenCalledWith(`${REFRESH_KEY_PREFIX}1`)
    expect(redisMock.set).toHaveBeenCalledWith(
      `${REFRESH_KEY_PREFIX}1`,
      expect.any(String),
      604800,
    )
  })

  it('刷新失败：jti 与 Redis 不一致（已顶号/已轮换）抛 401', async () => {
    jwtMock.verifyAsync.mockResolvedValue({ sub: 1, jti: 'old-jti' })
    redisMock.get.mockResolvedValue('new-jti')
    await expect(service.refresh('refresh-token')).rejects.toMatchObject({
      code: 401,
    })
    expect(redisMock.del).not.toHaveBeenCalled()
  })

  it('刷新失败：refresh token 无效抛 401', async () => {
    jwtMock.verifyAsync.mockRejectedValue(new Error('invalid token'))
    await expect(service.refresh('bad-token')).rejects.toMatchObject({
      code: 401,
    })
  })

  it('登出：删除 Redis 中的 refresh jti', async () => {
    redisMock.del.mockResolvedValue(1)
    await service.logout(1)
    expect(redisMock.del).toHaveBeenCalledWith(`${REFRESH_KEY_PREFIX}1`)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest src/auth/auth.service.spec.ts`
Expected: FAIL，报 `Cannot find module './auth.service'`。

- [ ] **Step 3: 实现 LoginDto 与 AuthService**

创建 `src/auth/dto/login.dto.ts`：

```typescript
import { IsEmail, IsNotEmpty } from 'class-validator'

export class LoginDto {
  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string

  @IsNotEmpty({ message: '密码不能为空' })
  password!: string
}
```

创建 `src/auth/auth.service.ts`：

```typescript
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { compare } from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { RedisService } from '../redis/redis.service'
import { User } from '../users/user.entity'
import { LoginDto } from './dto/login.dto'

// refresh token 在 Redis 中的 key 前缀（单端登录：同 userId 只存最新 jti）
export const REFRESH_KEY_PREFIX = 'auth:refresh:'

// access token 载荷
export interface AccessTokenPayload {
  sub: number
  email: string
  type: 'access'
}

// refresh token 载荷
interface RefreshTokenPayload {
  sub: number
  jti: string
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async login(loginDto: LoginDto, ip: string) {
    const user = await this.userRepo.findOne({
      where: { email: loginDto.email, delFlag: 0 },
    })
    if (!user) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '账号或密码错误')
    }
    if (user.status === 1) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '账号已被停用')
    }
    const passwordValid = await compare(loginDto.password, user.password)
    if (!passwordValid) {
      throw new AppError(ErrorCodes.BIZ_ERROR, '账号或密码错误')
    }

    const refreshJti = randomUUID()
    const accessToken = await this.signAccess(user.id, user.email)
    const refreshToken = await this.signRefresh(user.id, refreshJti)
    // 覆盖写入即实现单端登录：旧会话 refresh 立即失效
    await this.redisService.set(
      `${REFRESH_KEY_PREFIX}${user.id}`,
      refreshJti,
      this.refreshExpiresIn(),
    )
    await this.userRepo.update(user.id, {
      lastLoginIp: ip,
      lastLoginTime: new Date(),
    })

    const { password: _password, ...userWithoutPassword } = user
    void _password
    return { access_token: accessToken, refresh_token: refreshToken, user: userWithoutPassword }
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken)
    } catch {
      throw new AppError(ErrorCodes.UNAUTHORIZED, '登录状态已失效，请重新登录')
    }

    const storedJti = await this.redisService.get(
      `${REFRESH_KEY_PREFIX}${payload.sub}`,
    )
    if (storedJti !== payload.jti) {
      // 已被顶号、已登出或旧 token 重放
      throw new AppError(ErrorCodes.UNAUTHORIZED, '登录状态已失效，请重新登录')
    }

    // 轮换：删旧 jti，签发新 refresh
    const newJti = randomUUID()
    await this.redisService.del(`${REFRESH_KEY_PREFIX}${payload.sub}`)
    const accessToken = await this.signAccess(payload.sub, '')
    const newRefreshToken = await this.signRefresh(payload.sub, newJti)
    await this.redisService.set(
      `${REFRESH_KEY_PREFIX}${payload.sub}`,
      newJti,
      this.refreshExpiresIn(),
    )

    return { access_token: accessToken, refresh_token: newRefreshToken }
  }

  async logout(userId: number): Promise<void> {
    await this.redisService.del(`${REFRESH_KEY_PREFIX}${userId}`)
  }

  private signAccess(sub: number, email: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub, email, type: 'access' } satisfies AccessTokenPayload,
      { expiresIn: this.configService.get<number>('jwt.accessExpiresIn') },
    )
  }

  private signRefresh(sub: number, jti: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub, jti } satisfies RefreshTokenPayload,
      { expiresIn: this.configService.get<number>('jwt.refreshExpiresIn') },
    )
  }

  private refreshExpiresIn(): number {
    return this.configService.get<number>('jwt.refreshExpiresIn')!
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest src/auth/auth.service.spec.ts`
Expected: PASS（8 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/auth/
git commit -m "feat: 实现 AuthService 登录/刷新/登出逻辑与登录 DTO"
```

---

### Task 5: JwtStrategy + JwtAuthGuard + @Public 装饰器

**Files:**
- Create: `src/auth/jwt.strategy.ts`
- Create: `src/auth/auth.guard.ts`
- Test: `src/auth/auth.guard.spec.ts`

**Interfaces:**
- Consumes: `ConfigService`（`jwt.secret`）、`AccessTokenPayload`（Task 4 导出）
- Produces: `JwtAuthGuard`（全局守卫，`@Public()` 标记的接口放行）、`Public` 装饰器、`IS_PUBLIC_KEY` 常量；Task 6（AuthModule 注册 APP_GUARD）、Task 7（E2E）依赖

- [ ] **Step 1: 写失败测试**

创建 `src/auth/auth.guard.spec.ts`：

```typescript
import { Reflector } from '@nestjs/core'
import { JwtAuthGuard } from './auth.guard'

const reflectorMock = { getAllAndOverride: jest.fn() }
const contextMock = { getHandler: jest.fn(), getClass: jest.fn() }

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard

  beforeEach(() => {
    jest.clearAllMocks()
    guard = new JwtAuthGuard(reflectorMock as unknown as Reflector)
  })

  it('@Public 标记的接口直接放行', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true)
    const result = guard.canActivate(contextMock as never)
    expect(result).toBe(true)
    expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
      contextMock.getHandler(),
      contextMock.getClass(),
    ])
  })

  it('未标记 @Public 的接口走 JWT 验证（super.canActivate）', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false)
    // 无有效 token 时 AuthGuard('jwt') 抛 UnauthorizedException，此处验证进入 JWT 验证路径
    const result = guard.canActivate(contextMock as never)
    expect(result).toBeInstanceOf(Promise)
    return expect(result).rejects.toThrow()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest src/auth/auth.guard.spec.ts`
Expected: FAIL，报 `Cannot find module './auth.guard'`。

- [ ] **Step 3: 实现 JwtStrategy、JwtAuthGuard、Public 装饰器**

创建 `src/auth/jwt.strategy.ts`：

```typescript
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { AccessTokenPayload } from './auth.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    })
  }

  // access token 无状态验证：仅验签名、有效期与类型，不查数据库
  validate(payload: AccessTokenPayload): AccessTokenPayload {
    if (payload.type !== 'access') {
      throw new AppError(ErrorCodes.UNAUTHORIZED, '令牌类型无效，请重新登录')
    }
    return payload
  }
}
```

创建 `src/auth/auth.guard.ts`：

```typescript
import { ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { Observable } from 'rxjs'

export const IS_PUBLIC_KEY = 'isPublic'

// 全局守卫：@Public() 标记的接口放行，其余接口需携带有效 access token
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }
    return super.canActivate(context)
  }
}
```

创建 `src/auth/public.decorator.ts`：

```typescript
import { SetMetadata } from '@nestjs/common'
import { IS_PUBLIC_KEY } from './auth.guard'

// 标记接口无需登录（全局守卫放行）
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest src/auth/auth.guard.spec.ts`
Expected: PASS（2 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/auth/jwt.strategy.ts src/auth/auth.guard.ts src/auth/public.decorator.ts src/auth/auth.guard.spec.ts
git commit -m "feat: 新增 access token 无状态验证策略与全局 JwtAuthGuard"
```

---

### Task 6: AuthController + AuthModule + main.ts 挂载

**Files:**
- Create: `src/auth/auth.controller.ts`
- Create: `src/auth/auth.module.ts`
- Modify: `src/main.ts`（挂 cookieParser）
- Modify: `src/app/app.module.ts`（注册 AuthModule）
- Test: `src/auth/auth.controller.spec.ts`

**Interfaces:**
- Consumes: `AuthService`（Task 4）、`JwtAuthGuard`/`Public`（Task 5）、`ConfigService`（`jwt.refreshExpiresIn` 供 cookie maxAge）
- Produces: 路由 `POST /auth/login`、`POST /auth/refresh`、`POST /auth/logout`；全局守卫生效（AuthModule 内 APP_GUARD）；登录/刷新接口标 `@Public()`

- [ ] **Step 1: 写失败测试**

创建 `src/auth/auth.controller.spec.ts`：

```typescript
import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

const authServiceMock = {
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
}

const configMock = {
  get: (key: string) => (key === 'jwt.refreshExpiresIn' ? 604800 : undefined),
}

const resMock = {
  cookie: jest.fn(),
}

describe('AuthController', () => {
  let controller: AuthController

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile()
    controller = moduleRef.get(AuthController)
  })

  afterEach(() => jest.clearAllMocks())

  it('登录：调用 service 并把 refresh 写入 httpOnly cookie', async () => {
    authServiceMock.login.mockResolvedValue({
      access_token: 'at',
      refresh_token: 'rt',
      user: { id: 1 },
    })
    const req = { ip: '10.0.0.1', socket: {} }
    const result = await controller.login(
      { email: 'a@b.com', password: '123456' },
      req as never,
      resMock as never,
    )
    expect(authServiceMock.login).toHaveBeenCalledWith(
      { email: 'a@b.com', password: '123456' },
      '10.0.0.1',
    )
    expect(resMock.cookie).toHaveBeenCalledWith(
      'refresh',
      'rt',
      expect.objectContaining({ httpOnly: true, path: '/auth/refresh' }),
    )
    expect(result).toEqual({ access_token: 'at', user: { id: 1 } })
  })

  it('刷新：无 refresh cookie 抛 401', async () => {
    const req = { cookies: {} }
    await expect(controller.refresh(req as never, resMock as never)).rejects.toMatchObject({
      code: 401,
    })
  })

  it('登出：调用 service.logout', async () => {
    authServiceMock.logout.mockResolvedValue(undefined)
    const req = { user: { sub: 7 } }
    await controller.logout(req as never)
    expect(authServiceMock.logout).toHaveBeenCalledWith(7)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest src/auth/auth.controller.spec.ts`
Expected: FAIL，报 `Cannot find module './auth.controller'`。

- [ ] **Step 3: 实现 AuthController 与 AuthModule，挂载到应用**

创建 `src/auth/auth.controller.ts`：

```typescript
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { Public } from './public.decorator'

// refresh token 的 cookie 名与路径：仅 /auth/refresh 请求自动携带
export const REFRESH_COOKIE = 'refresh'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? ''
    const result = await this.authService.login(loginDto, ip)
    this.setRefreshCookie(res, result.refresh_token)
    const { refresh_token: _rt, ...rest } = result
    void _rt
    return rest
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE]
    if (!refreshToken) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, '缺少 refresh token')
    }
    const result = await this.authService.refresh(refreshToken)
    this.setRefreshCookie(res, result.refresh_token)
    const { refresh_token: _rt, ...rest } = result
    void _rt
    return rest
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request) {
    // 登出需已登录（走全局守卫），从 access token 中取用户
    const user = (req as Request & { user?: { sub: number } }).user
    if (user) {
      await this.authService.logout(user.sub)
    }
    return { message: '已退出登录' }
  }

  private setRefreshCookie(res: Response, token: string): void {
    const maxAge = this.configService.get<number>('jwt.refreshExpiresIn')! * 1000
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge,
    })
  }
}
```

创建 `src/auth/auth.module.ts`：

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '../users/user.entity'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './auth.guard'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // 全局守卫：所有未标 @Public 的接口默认要求登录
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
```

修改 `src/main.ts`（在 `app.useLogger(logger)` 之后加一行）：

```typescript
import cookieParser from 'cookie-parser'
```

在 `app.useGlobalPipes(...)` 之前加入：

```typescript
app.use(cookieParser())
```

修改 `src/app/app.module.ts`：imports 数组在 `UsersModule` 后增加 `AuthModule`（import 语句加 `import { AuthModule } from '../auth/auth.module'`）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest src/auth/auth.controller.spec.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 全量单测确认无回归**

Run: `npm test`
Expected: 全部通过（现有 13 个 + 新增用例）。

- [ ] **Step 6: Commit**

```bash
git add src/auth/ src/main.ts src/app/app.module.ts
git commit -m "feat: 新增认证接口与全局守卫挂载，启用 cookie-parser"
```

---

### Task 7: auth.e2e-spec 集成测试

**Files:**
- Create: `src/auth/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `AuthController`、`AuthService`、`JwtAuthGuard`（真实 JwtModule 签发/验证）、`UsersController`（受保护接口示例）、`TransformInterceptor`、`AllExceptionsFilter`（遵循项目 e2e 模式）
- Produces: 覆盖"登录 → 鉴权 → 刷新 → 登出"完整契约的自动化验证

- [ ] **Step 1: 写失败测试**

创建 `src/auth/auth.e2e-spec.ts`（mock 仓库与 Redis，真实 JWT 签发；参照 `src/users/users.e2e-spec.ts` 的模块组装风格）：

```typescript
import type { Server } from 'node:http'

import {
  Controller,
  Get,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { hash } from 'bcryptjs'
import { PinoLogger } from 'nestjs-pino'
import request from 'supertest'
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter'
import { ErrorHandler } from '../common/errors/error-handler'
import { TransformInterceptor } from '../common/interceptors/transform.interceptor'
import { RedisService } from '../redis/redis.service'
import { User } from '../users/user.entity'
import { UsersController } from '../users/users.controller'
import { UsersService } from '../users/users.service'
import { AuthController } from './auth.controller'
import { JwtAuthGuard } from './auth.guard'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'

@Controller('home')
class HomeController {
  @Get()
  home(): string {
    return 'home'
  }
}

describe('认证 E2E', () => {
  let app: INestApplication
  let httpServer: Server
  let agent: ReturnType<typeof request.agent>
  const userRepo = { findOne: jest.fn(), update: jest.fn() }
  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
  let hashedPassword: string

  beforeAll(async () => {
    hashedPassword = await hash('123456', 10)
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: 'test-secret' }),
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              jwt: { secret: 'test-secret', accessExpiresIn: 1800, refreshExpiresIn: 604800 },
            }),
          ],
        }),
      ],
      controllers: [AuthController, UsersController, HomeController],
      providers: [
        AuthService,
        UsersService,
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: RedisService, useValue: redisMock },
        {
          provide: PinoLogger,
          useValue: { error: jest.fn(), fatal: jest.fn(), warn: jest.fn() },
        },
        ErrorHandler,
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
    await app.init()
    httpServer = app.getHttpServer() as Server
    agent = request.agent(httpServer)
  })

  afterAll(async () => {
    await app.close()
  })

  const mockUser = () => ({
    id: 1,
    nickname: '甄嬛',
    email: 'admin@example.com',
    password: hashedPassword,
    status: 0,
    delFlag: 0,
    lastLoginIp: '',
    lastLoginTime: null,
  })

  it('登录：返回 access_token 与 user，Set-Cookie refresh', async () => {
    userRepo.findOne.mockResolvedValue(mockUser())
    userRepo.update.mockResolvedValue({ affected: 1 })
    redisMock.set.mockResolvedValue(undefined)

    const res = await agent.post('/auth/login').send({
      email: 'admin@example.com',
      password: '123456',
    })
    expect(res.status).toBe(200)
    const body = res.body as {
      code: number
      data: { access_token: string; user: { id: number } }
    }
    expect(body.code).toBe(0)
    expect(body.data.access_token).toEqual(expect.any(String))
    expect(body.data.user).not.toHaveProperty('password')
    const setCookie = res.headers['set-cookie'] as unknown as string[]
    expect(setCookie.join(';')).toContain('refresh=')
    expect(setCookie.join(';')).toContain('HttpOnly')
  })

  it('未登录访问受保护接口：401', async () => {
    const res = await request(httpServer).get('/home')
    expect(res.status).toBe(401)
    expect((res.body as { code: number }).code).toBe(401)
  })

  it('携带 access token 访问受保护接口：成功', async () => {
    const loginRes = await agent.post('/auth/login').send({
      email: 'admin@example.com',
      password: '123456',
    })
    const accessToken = (loginRes.body as { data: { access_token: string } }).data.access_token
    userRepo.findOne.mockResolvedValue(mockUser())

    const res = await request(httpServer)
      .get('/users/1')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    expect((res.body as { code: number }).code).toBe(0)
  })

  it('刷新：携带 refresh cookie 换新 access', async () => {
    const loginRes = await agent.post('/auth/login').send({
      email: 'admin@example.com',
      password: '123456',
    })
    const oldAccess = (loginRes.body as { data: { access_token: string } }).data.access_token
    redisMock.get.mockResolvedValue(expect.any(String))
    // refresh 使用 agent 自动携带的 cookie；jti 由登录时随机生成，这里放宽比对为任意字符串
    redisMock.get.mockResolvedValue('any-jti')
    const res = await agent.post('/auth/refresh')
    expect(res.status).toBe(200)
    const data = (res.body as { data: { access_token: string } }).data
    expect(data.access_token).toEqual(expect.any(String))
    expect(data.access_token).not.toBe(oldAccess)
  })
})
```

> 注意：`auth.e2e-spec.ts` 需 `import cookieParser from 'cookie-parser'`（顶部 import 中补充）。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --config test/jest-e2e.json src/auth/auth.e2e-spec.ts`
Expected: FAIL（模块缺少依赖或断言失败）。

- [ ] **Step 3: 修正并运行通过**

如遇 mock 细节不匹配（如 refresh 的 jti 比对），调整测试：登录成功后 `redisMock.get` 返回登录时写入的 jti。可改为在登录断言中捕获 `redisMock.set` 的入参 jti：

```typescript
// 登录用例中捕获 jti 供刷新用例使用
let capturedJti: string
// 在登录测试内：
expect(redisMock.set).toHaveBeenCalled()
capturedJti = (redisMock.set.mock.calls[0] as [string, string])[1]
```

Run: `npx jest --config test/jest-e2e.json src/auth/auth.e2e-spec.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 4: 全量验证**

Run: `npm test && npm run test:e2e`
Expected: 单测与 E2E 全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/auth/auth.e2e-spec.ts
git commit -m "test: 新增认证登录/刷新/登出 E2E 集成测试"
```

---

### Task 8: 手动端到端验证（真实 MySQL + Redis）

**Files:**
- 无新增文件（验证性质）

**Interfaces:**
- Consumes: Task 2 的 Redis 打通、本地 MySQL（`config.yaml` 的 `database` 段）、`pnpm seed` 初始用户
- Produces: 真实环境验证结论

- [ ] **Step 1: 启动服务**

确认 portproxy 已配置（Task 2 Step 4），然后：

```bash
pnpm redis:link   # 若 WSL 重启过需重跑；确保 127.0.0.1:6379 可达
pnpm seed         # 确保初始用户存在（admin@example.com / 123456）
pnpm start:dev
```

Expected: 启动成功，控制台打印接口地址 `http://localhost:3000`。

- [ ] **Step 2: 登录**

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"123456"}'
```

Expected: HTTP 200，body `{ code: 0, data: { access_token, user } }`，响应头含 `Set-Cookie: refresh=...; HttpOnly; Path=/auth/refresh`。

- [ ] **Step 3: 访问受保护接口（带 access）**

```bash
TOKEN=$(node -e "const b=require('fs').readFileSync(process.argv[1],'utf8').split('access_token\":\"')[1].split('\"')[0]" <(curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"123456"}'))
curl -s http://localhost:3000/users/1 -H "Authorization: Bearer $TOKEN"
```

Expected: HTTP 200，body `{ code: 0, message: 'ok', data: { ...user } }`。

- [ ] **Step 4: 无 token 访问 → 401**

```bash
curl -s http://localhost:3000/users/1
```

Expected: HTTP 401，body `{ code: 401, message: '未登录或登录状态过期' }`。

- [ ] **Step 5: 刷新（携带 cookie）**

```bash
curl -i -b cookies.txt -X POST http://localhost:3000/auth/refresh
```

Expected: HTTP 200，返回新 `access_token`，且 `Set-Cookie` 更新 refresh（轮换）。

- [ ] **Step 6: 登出后 refresh 失效**

```bash
TOKEN=$(从 Step 3 获取或重新登录)
curl -i -b cookies.txt -X POST http://localhost:3000/auth/logout -H "Authorization: Bearer $TOKEN"
# 随后用旧 refresh cookie 再刷新应失败：
curl -i -b cookies.txt -X POST http://localhost:3000/auth/refresh
```

Expected: 登出返回 `{ code: 0, data: { message: '已退出登录' } }`；随后刷新返回 HTTP 401 `登录状态已失效，请重新登录`。

- [ ] **Step 7: 单端顶号验证（可选）**

用同一账号在另一会话（新 cookies.txt）登录 → 用旧会话的 refresh cookie 刷新 → Expected 401。

---

## Self-Review 记录

- **Spec 覆盖**：设计文档全部小节均有对应任务（架构→Task 3/6；数据流→Task 4/6；Redis 键设计→Task 4；安全要点→Task 4/5/6；配置变更→Task 1；配套改动→Task 6/7/8；环境打通→Task 2；测试计划→Task 3-7）。设计文档"配套改动 2（GET /users/:id 挂守卫）"由全局守卫实现，users e2e 使用独立测试模块（无守卫）不受影响。
- **占位符扫描**：无 TBD/TODO；每个代码步骤均含完整代码。
- **类型一致性**：`AccessTokenPayload`（Task 4 导出，Task 5/7 引用）、`REFRESH_KEY_PREFIX`（Task 4/6 引用）、`IS_PUBLIC_KEY`（Task 5 导出，Task 6 装饰器引用）、`REFRESH_COOKIE`（Task 6 定义并自用）命名一致。
