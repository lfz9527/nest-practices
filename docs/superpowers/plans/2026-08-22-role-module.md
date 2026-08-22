# 角色模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增角色模块（roles），用户与角色一对多关联（users.roleId），登录与用户查询接口返回角色信息。

**Architecture:** 独立 `src/roles/` 模块（实体/服务/控制器/DTO），`users` 表加 `roleId` 列；`AuthService` 与 `UsersService` 各自注入 Role 仓库做关联查询。HTTP 方法仅允许 GET/POST：更新用 `POST /roles/update`、删除用 `POST /roles/delete`。

**Tech Stack:** NestJS 11 + TypeORM 1.1 + MySQL 8 + class-validator + Jest 30（ts-jest）+ supertest

## Global Constraints

- 二次路由要求及限制：接口 HTTP 方法仅允许 GET、POST，禁用 PATCH / PUT / DELETE 等其余方法（更新/删除功能通过 POST 路径实现，见 Task 2）
- 响应契约：成功 HTTP 200 `{ code: 0, message: 'ok', data }`；业务错误 HTTP 200 `{ code: -1, message, data: null }`
- 错误统一 `AppError(ErrorCodes.BIZ_ERROR)`，不新增错误码
- 所有接口需登录（全局 `JwtAuthGuard`，未标 `@Public()`）；POST 接口显式 `@HttpCode(200)`
- 校验：`ValidationPipe({ whitelist: true })` + class-validator，校验消息用中文
- 代码风格：无分号、单引号、尾逗号、LF 换行
- 软删除 `delFlag`: 0=存在 2=删除；唯一约束 `(roleKey, delFlag)`
- 角色对外返回 `{ id, name, roleKey }`（`RoleInfo` 接口，定义于 `role.entity.ts`）
- `roleKey` 创建后不可修改
- 删除角色：软删除（`delFlag = 2`）+ 置空 `users.roleId`（`null`）
- 测试命令：单测 `pnpm test`、E2E `pnpm test:e2e`、构建 `pnpm build`
- 提交遵循 git-conventions：`<type>: <subject>`，提交前需用户确认

---

### Task 1: Role 实体与用户角色关联字段

**Files:**
- Create: `src/roles/role.entity.ts`
- Modify: `src/users/user.entity.ts`（加 roleId 列）
- Modify: `src/users/users.module.ts`、`src/auth/auth.module.ts`（forFeature 加 Role）

**Interfaces:**
- Produces: `Role` 实体（`src/roles/role.entity.ts`），含 `id: number`、`name: string`、`roleKey: string`、`status: number`、`sort: number`、`remark: string`、`delFlag: number`、`createdAt/updatedAt: Date`；并导出 `RoleInfo = { id, name, roleKey }`
- Produces: `User.roleId: number | null`（nullable bigint）

- [ ] **Step 1: 创建 Role 实体**

创建 `src/roles/role.entity.ts`：

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'

// 角色对外暴露的简要信息（登录/用户查询返回）
export interface RoleInfo {
  id: number
  name: string
  roleKey: string
}

@Entity('roles')
@Unique(['roleKey', 'delFlag'])
export class Role {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number

  @Column({ type: 'varchar', length: 30, default: '' })
  name!: string

  @Column({ type: 'varchar', length: 50, default: '' })
  roleKey!: string

  @Column({ type: 'tinyint', default: 0, comment: '角色状态: 0=正常 1=停用' })
  status!: number

  @Column({ type: 'int', default: 0, comment: '显示顺序' })
  sort!: number

  @Column({ type: 'varchar', length: 255, default: '' })
  remark!: string

  @Index()
  @Column({ type: 'tinyint', default: 0, comment: '删除标志: 0=存在 2=删除' })
  delFlag!: number

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date
}
```

- [ ] **Step 2: User 实体加 roleId 列**

`src/users/user.entity.ts` 在 `password` 列之后插入：

```ts
  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: '角色 id',
  })
  roleId!: number | null
```

- [ ] **Step 3: users/auth 模块注册 Role 仓库**

`src/users/users.module.ts`：`TypeOrmModule.forFeature([User])` → `TypeOrmModule.forFeature([User, Role])`，并加 import `import { Role } from '../roles/role.entity'`。

`src/auth/auth.module.ts`：`TypeOrmModule.forFeature([User])` → `TypeOrmModule.forFeature([User, Role])`，并加 import `import { Role } from '../roles/role.entity'`。

- [ ] **Step 4: 验证**

运行：`pnpm lint && pnpm test && pnpm build`
预期：全部通过（本任务未改动任何 service 逻辑，现有测试不受影响）。

- [ ] **Step 5: Commit**

遵循 git-conventions（提交前经用户确认）：
```bash
git add src/roles/role.entity.ts src/users/user.entity.ts src/users/users.module.ts src/auth/auth.module.ts
git commit -m "feat: 新增角色实体与用户角色关联字段"
```

---

### Task 2: roles 模块 CRUD 接口

**Files:**
- Create: `src/roles/dto/query-roles.dto.ts`、`src/roles/dto/create-role.dto.ts`、`src/roles/dto/update-role.dto.ts`、`src/roles/dto/delete-role.dto.ts`
- Create: `src/roles/roles.service.ts`、`src/roles/roles.controller.ts`、`src/roles/roles.module.ts`
- Create: `src/roles/roles.service.spec.ts`、`src/roles/roles.e2e-spec.ts`
- Modify: `src/app/app.module.ts`（注册 RolesModule）

**Interfaces:**
- Consumes: `Role` 实体、`User` 实体（Task 1）
- Produces: `RolesService`（`findAll(query: QueryRolesDto): Promise<{ list: Role[]; total: number }>`、`findById(id: number): Promise<Role>`、`create(dto: CreateRoleDto): Promise<Role>`、`update(dto: UpdateRoleDto): Promise<Role>`、`remove(id: number): Promise<void>`）
- Produces: 路由 `GET /roles`、`GET /roles/:id`、`POST /roles`、`POST /roles/update`、`POST /roles/delete`

- [ ] **Step 1: 编写失败的单元测试**

创建 `src/roles/roles.service.spec.ts`：

```ts
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AppError } from '../common/errors/app-error'
import { User } from '../users/user.entity'
import { Role } from './role.entity'
import { RolesService } from './roles.service'

describe('RolesService', () => {
  let service: RolesService
  const roleRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  }
  const userRepo = { update: jest.fn() }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile()
    service = moduleRef.get(RolesService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const mockRole = (overrides: Partial<Role> = {}): Role =>
    ({
      id: 1,
      name: '管理员',
      roleKey: 'admin',
      status: 0,
      sort: 0,
      remark: '',
      delFlag: 0,
      ...overrides,
    }) as Role

  it('findAll：按分页与筛选条件查询', async () => {
    roleRepo.findAndCount.mockResolvedValue([[mockRole()], 1])

    const result = await service.findAll({
      page: 2,
      pageSize: 20,
      name: '管',
      status: 0,
    })

    expect(result).toEqual({ list: [mockRole()], total: 1 })
    expect(roleRepo.findAndCount).toHaveBeenCalledWith({
      where: {
        delFlag: 0,
        name: expect.any(Object),
        status: 0,
      },
      order: { sort: 'ASC', id: 'DESC' },
      skip: 20,
      take: 20,
    })
  })

  it('findAll：无筛选条件时不传 name/status', async () => {
    roleRepo.findAndCount.mockResolvedValue([[], 0])

    await service.findAll({ page: 1, pageSize: 10 })

    expect(roleRepo.findAndCount).toHaveBeenCalledWith({
      where: { delFlag: 0 },
      order: { sort: 'ASC', id: 'DESC' },
      skip: 0,
      take: 10,
    })
  })

  it('findById：存在时返回角色', async () => {
    roleRepo.findOne.mockResolvedValue(mockRole())

    const result = await service.findById(1)

    expect(result).toEqual(mockRole())
    expect(roleRepo.findOne).toHaveBeenCalledWith({
      where: { id: 1, delFlag: 0 },
    })
  })

  it('findById：角色不存在时抛 code -1 的 AppError', async () => {
    roleRepo.findOne.mockResolvedValue(null)

    const promise = service.findById(999)

    await expect(promise).rejects.toBeInstanceOf(AppError)
    await expect(promise).rejects.toMatchObject({
      code: -1,
      message: '角色 999 不存在',
    })
  })

  it('create：保存成功', async () => {
    const dto = {
      name: '测试角色',
      roleKey: 'test',
      status: 0,
      sort: 0,
      remark: '',
    }
    roleRepo.findOne.mockResolvedValue(null)
    roleRepo.create.mockReturnValue(dto)
    roleRepo.save.mockResolvedValue(mockRole(dto))

    const result = await service.create(dto)

    expect(result).toEqual(mockRole(dto))
    expect(roleRepo.create).toHaveBeenCalledWith(dto)
    expect(roleRepo.save).toHaveBeenCalledWith(dto)
  })

  it('create：roleKey 已存在（含软删除）时抛错', async () => {
    roleRepo.findOne.mockResolvedValue(mockRole({ delFlag: 2 }))

    const promise = service.create({
      name: '测试角色',
      roleKey: 'test',
      status: 0,
      sort: 0,
      remark: '',
    })

    await expect(promise).rejects.toMatchObject({
      code: -1,
      message: '角色编码 test 已存在',
    })
    expect(roleRepo.create).not.toHaveBeenCalled()
  })

  it('update：更新成功并返回最新数据', async () => {
    roleRepo.findOne
      .mockResolvedValueOnce(mockRole())
      .mockResolvedValueOnce(mockRole({ name: '新名称' }))
    roleRepo.update.mockResolvedValue({ affected: 1 })

    const result = await service.update({
      id: 1,
      name: '新名称',
      status: 1,
      sort: 5,
      remark: '备注',
    })

    expect(roleRepo.update).toHaveBeenCalledWith(1, {
      name: '新名称',
      status: 1,
      sort: 5,
      remark: '备注',
    })
    expect(result.name).toBe('新名称')
  })

  it('update：字段缺省时保留原值', async () => {
    roleRepo.findOne
      .mockResolvedValueOnce(mockRole({ status: 1, sort: 5, remark: '旧备注' }))
      .mockResolvedValueOnce(mockRole())
    roleRepo.update.mockResolvedValue({ affected: 1 })

    await service.update({ id: 1, name: '仅改名' })

    expect(roleRepo.update).toHaveBeenCalledWith(1, {
      name: '仅改名',
      status: 1,
      sort: 5,
      remark: '旧备注',
    })
  })

  it('update：角色不存在时抛错', async () => {
    roleRepo.findOne.mockResolvedValue(null)

    await expect(
      service.update({ id: 999, name: 'x' }),
    ).rejects.toMatchObject({ code: -1, message: '角色 999 不存在' })
  })

  it('remove：软删除并置空关联用户 roleId', async () => {
    roleRepo.findOne.mockResolvedValue(mockRole())
    roleRepo.update.mockResolvedValue({ affected: 1 })
    userRepo.update.mockResolvedValue({ affected: 1 })

    await service.remove(1)

    expect(roleRepo.update).toHaveBeenCalledWith(1, { delFlag: 2 })
    expect(userRepo.update).toHaveBeenCalledWith(
      { roleId: 1 },
      { roleId: null },
    )
  })

  it('remove：角色不存在时抛错', async () => {
    roleRepo.findOne.mockResolvedValue(null)

    await expect(service.remove(999)).rejects.toMatchObject({
      code: -1,
      message: '角色 999 不存在',
    })
    expect(userRepo.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

运行：`pnpm test -- roles.service.spec.ts`
预期：失败（`Cannot find module './roles.service'`）。

- [ ] **Step 3: 编写 DTO**

创建 `src/roles/dto/query-roles.dto.ts`：

```ts
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'

export class QueryRolesDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: '页码最小为 1' })
  page = 1

  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: '每页条数最小为 1' })
  @Max(100, { message: '每页条数最大为 100' })
  pageSize = 10

  @IsOptional()
  name?: string

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number
}
```

创建 `src/roles/dto/create-role.dto.ts`：

```ts
import { IsIn, IsInt, IsNotEmpty, IsOptional, Length, MaxLength } from 'class-validator'

export class CreateRoleDto {
  @IsNotEmpty({ message: '角色名称不能为空' })
  @Length(1, 30, { message: '角色名称长度需在 1-30 之间' })
  name!: string

  @IsNotEmpty({ message: '角色编码不能为空' })
  @Length(1, 50, { message: '角色编码长度需在 1-50 之间' })
  roleKey!: string

  @IsOptional()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status = 0

  @IsOptional()
  @IsInt({ message: '排序必须是整数' })
  sort = 0

  @IsOptional()
  @MaxLength(255, { message: '备注不能超过 255 字符' })
  remark = ''
}
```

创建 `src/roles/dto/update-role.dto.ts`：

```ts
import { IsIn, IsInt, IsNotEmpty, IsOptional, Length, MaxLength } from 'class-validator'

export class UpdateRoleDto {
  @IsNotEmpty({ message: '角色 id 不能为空' })
  @IsInt({ message: '角色 id 必须是数字' })
  id!: number

  @IsNotEmpty({ message: '角色名称不能为空' })
  @Length(1, 30, { message: '角色名称长度需在 1-30 之间' })
  name!: string

  @IsOptional()
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number

  @IsOptional()
  @IsInt({ message: '排序必须是整数' })
  sort?: number

  @IsOptional()
  @MaxLength(255, { message: '备注不能超过 255 字符' })
  remark?: string
}
```

创建 `src/roles/dto/delete-role.dto.ts`：

```ts
import { IsInt, IsNotEmpty } from 'class-validator'

export class DeleteRoleDto {
  @IsNotEmpty({ message: '角色 id 不能为空' })
  @IsInt({ message: '角色 id 必须是数字' })
  id!: number
}
```

- [ ] **Step 4: 编写 RolesService**

创建 `src/roles/roles.service.ts`：

```ts
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { AppError } from '../common/errors/app-error'
import { ErrorCodes } from '../common/errors/error-codes'
import { User } from '../users/user.entity'
import { CreateRoleDto } from './dto/create-role.dto'
import { QueryRolesDto } from './dto/query-roles.dto'
import { UpdateRoleDto } from './dto/update-role.dto'
import { Role } from './role.entity'

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(query: QueryRolesDto): Promise<{ list: Role[]; total: number }> {
    const [list, total] = await this.roleRepo.findAndCount({
      where: {
        delFlag: 0,
        ...(query.name ? { name: Like(`%${query.name}%`) } : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
      },
      order: { sort: 'ASC', id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    })
    return { list, total }
  }

  async findById(id: number): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id, delFlag: 0 } })
    if (!role) {
      throw new AppError(ErrorCodes.BIZ_ERROR, `角色 ${id} 不存在`)
    }
    return role
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    await this.assertRoleKeyUnique(dto.roleKey)
    return this.roleRepo.save(this.roleRepo.create(dto))
  }

  async update(dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findById(dto.id)
    await this.roleRepo.update(dto.id, {
      name: dto.name,
      status: dto.status ?? role.status,
      sort: dto.sort ?? role.sort,
      remark: dto.remark ?? role.remark,
    })
    return this.findById(dto.id)
  }

  async remove(id: number): Promise<void> {
    await this.findById(id)
    await this.roleRepo.update(id, { delFlag: 2 })
    await this.userRepo.update({ roleId: id }, { roleId: null })
  }

  // roleKey 唯一（含软删除数据），保证 (roleKey, delFlag) 唯一约束不冲突
  private async assertRoleKeyUnique(roleKey: string): Promise<void> {
    const exists = await this.roleRepo.findOne({ where: { roleKey } })
    if (exists) {
      throw new AppError(ErrorCodes.BIZ_ERROR, `角色编码 ${roleKey} 已存在`)
    }
  }
}
```

- [ ] **Step 5: 编写 RolesController**

创建 `src/roles/roles.controller.ts`：

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common'
import { CreateRoleDto } from './dto/create-role.dto'
import { DeleteRoleDto } from './dto/delete-role.dto'
import { QueryRolesDto } from './dto/query-roles.dto'
import { UpdateRoleDto } from './dto/update-role.dto'
import { RolesService } from './roles.service'

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@Query() query: QueryRolesDto) {
    return this.rolesService.findAll(query)
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findById(id)
  }

  @Post()
  @HttpCode(200)
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto)
  }

  @Post('update')
  @HttpCode(200)
  update(@Body() dto: UpdateRoleDto) {
    return this.rolesService.update(dto)
  }

  @Post('delete')
  @HttpCode(200)
  remove(@Body() dto: DeleteRoleDto) {
    return this.rolesService.remove(dto.id)
  }
}
```

- [ ] **Step 6: 编写 RolesModule 并注册**

创建 `src/roles/roles.module.ts`：

```ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '../users/user.entity'
import { Role } from './role.entity'
import { RolesController } from './roles.controller'
import { RolesService } from './roles.service'

@Module({
  imports: [TypeOrmModule.forFeature([Role, User])],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
```

`src/app/app.module.ts` 的 imports 中（UsersModule 之后、AuthModule 之前）加：

```ts
    // 角色模块
    RolesModule,
```

并加 import `import { RolesModule } from '../roles/roles.module'`。

- [ ] **Step 7: 运行单元测试验证通过**

运行：`pnpm test -- roles.service.spec.ts`
预期：全部 PASS。

- [ ] **Step 8: 编写 E2E 测试**

创建 `src/roles/roles.e2e-spec.ts`：

```ts
import type { Server } from 'node:http'

import {
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
import { AuthController } from '../auth/auth.controller'
import { JwtAuthGuard } from '../auth/auth.guard'
import { AuthService } from '../auth/auth.service'
import { CaptchaService } from '../auth/captcha.service'
import { JwtStrategy } from '../auth/jwt.strategy'
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter'
import { ErrorHandler } from '../common/errors/error-handler'
import { TransformInterceptor } from '../common/interceptors/transform.interceptor'
import { RedisService } from '../redis/redis.service'
import { User } from '../users/user.entity'
import { Role } from './role.entity'
import { RolesController } from './roles.controller'
import { RolesService } from './roles.service'

describe('角色模块 E2E', () => {
  let app: INestApplication
  let httpServer: Server
  const userRepo = { findOne: jest.fn(), update: jest.fn() }
  const roleRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  }
  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
  let hashedPassword: string

  beforeEach(() => {
    jest.clearAllMocks()
  })

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
              jwt: { secret: 'test-secret', accessExpiresIn: 604800 },
              captcha: { expiresIn: 300 },
            }),
          ],
        }),
      ],
      controllers: [AuthController, RolesController],
      providers: [
        AuthService,
        { provide: CaptchaService, useValue: { verify: jest.fn() } },
        RolesService,
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
    await app.init()
    httpServer = app.getHttpServer() as Server
  })

  afterAll(async () => {
    await app.close()
  })

  // 登录 helper：用户无角色（不触发角色关联查询）
  const loginAndGetToken = async () => {
    userRepo.findOne.mockResolvedValue({
      id: 1,
      nickname: '甄嬛',
      email: 'admin@example.com',
      password: hashedPassword,
      status: 0,
      delFlag: 0,
      lastLoginIp: '',
      lastLoginTime: null,
    })
    userRepo.update.mockResolvedValue({ affected: 1 })
    redisMock.set.mockResolvedValue(undefined)
    const res = await request(httpServer).post('/auth/login').send({
      email: 'admin@example.com',
      password: '123456',
      captchaId: 'captcha-id',
      captchaCode: '1234',
    })
    return (res.body as { data: { access_token: string } }).data.access_token
  }

  const mockRole = (overrides: Partial<Role> = {}): Role =>
    ({
      id: 1,
      name: '管理员',
      roleKey: 'admin',
      status: 0,
      sort: 0,
      remark: '',
      delFlag: 0,
      createdAt: new Date('2026-08-22T00:00:00Z'),
      updatedAt: new Date('2026-08-22T00:00:00Z'),
      ...overrides,
    }) as Role

  it('未登录访问 /roles：业务错误形态 401', async () => {
    const res = await request(httpServer).get('/roles')
    expect(res.status).toBe(200)
    expect((res.body as { code: number }).code).toBe(401)
  })

  it('GET /roles 分页列表：返回 { list, total }', async () => {
    const token = await loginAndGetToken()
    roleRepo.findAndCount.mockResolvedValue([[mockRole()], 1])

    const res = await request(httpServer)
      .get('/roles?page=1&pageSize=10&name=管')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const body = res.body as { code: number; data: { list: Role[]; total: number } }
    expect(body.code).toBe(0)
    expect(body.data.total).toBe(1)
    expect(body.data.list[0].roleKey).toBe('admin')
  })

  it('GET /roles/:id 详情：成功与不存在', async () => {
    const token = await loginAndGetToken()

    roleRepo.findOne.mockResolvedValue(mockRole())
    const ok = await request(httpServer)
      .get('/roles/1')
      .set('Authorization', `Bearer ${token}`)
    expect(ok.status).toBe(200)
    expect((ok.body as { code: number }).code).toBe(0)
    expect(
      (ok.body as { data: Role }).data.name,
    ).toBe('管理员')

    roleRepo.findOne.mockResolvedValue(null)
    const missing = await request(httpServer)
      .get('/roles/999')
      .set('Authorization', `Bearer ${token}`)
    expect((missing.body as { code: number }).code).toBe(-1)
    expect((missing.body as { message: string }).message).toBe('角色 999 不存在')
  })

  it('POST /roles 创建成功：返回角色，HTTP 200', async () => {
    const token = await loginAndGetToken()
    roleRepo.findOne.mockResolvedValue(null)
    roleRepo.create.mockReturnValue(mockRole({ name: '测试角色', roleKey: 'test' }))
    roleRepo.save.mockResolvedValue(mockRole({ name: '测试角色', roleKey: 'test' }))

    const res = await request(httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '测试角色', roleKey: 'test' })

    expect(res.status).toBe(200)
    const body = res.body as { code: number; data: Role }
    expect(body.code).toBe(0)
    expect(body.data.roleKey).toBe('test')
  })

  it('POST /roles roleKey 重复：业务错误 code -1', async () => {
    const token = await loginAndGetToken()
    roleRepo.findOne.mockResolvedValue(mockRole())

    const res = await request(httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '管理员', roleKey: 'admin' })

    expect(res.status).toBe(200)
    const body = res.body as { code: number; message: string }
    expect(body.code).toBe(-1)
    expect(body.message).toBe('角色编码 admin 已存在')
  })

  it('POST /roles 参数校验失败：HTTP 200 + code -1', async () => {
    const token = await loginAndGetToken()

    const res = await request(httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ roleKey: 'x' })

    expect(res.status).toBe(200)
    expect((res.body as { code: number }).code).toBe(-1)
    expect((res.body as { message: string }).message).toContain('角色名称不能为空')
  })

  it('POST /roles/update 更新成功', async () => {
    const token = await loginAndGetToken()
    roleRepo.findOne
      .mockResolvedValueOnce(mockRole())
      .mockResolvedValueOnce(mockRole({ name: '超级管理员' }))
    roleRepo.update.mockResolvedValue({ affected: 1 })

    const res = await request(httpServer)
      .post('/roles/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 1, name: '超级管理员', status: 1, sort: 10, remark: '核心' })

    expect(res.status).toBe(200)
    const body = res.body as { code: number; data: Role }
    expect(body.code).toBe(0)
    expect(body.data.name).toBe('超级管理员')
  })

  it('POST /roles/delete 删除：软删除并置空用户引用', async () => {
    const token = await loginAndGetToken()
    roleRepo.findOne.mockResolvedValue(mockRole())
    roleRepo.update.mockResolvedValue({ affected: 1 })
    userRepo.update.mockResolvedValue({ affected: 1 })

    const res = await request(httpServer)
      .post('/roles/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 1 })

    expect(res.status).toBe(200)
    expect((res.body as { code: number }).code).toBe(0)
    expect(roleRepo.update).toHaveBeenCalledWith(1, { delFlag: 2 })
    expect(userRepo.update).toHaveBeenCalledWith({ roleId: 1 }, { roleId: null })
  })
})
```

- [ ] **Step 9: 运行 E2E 测试验证通过**

运行：`pnpm test:e2e -- roles.e2e-spec.ts`
预期：全部 PASS。

- [ ] **Step 10: 全量验证**

运行：`pnpm lint && pnpm test && pnpm test:e2e && pnpm build`
预期：全部通过。

- [ ] **Step 11: Commit**

遵循 git-conventions（提交前经用户确认）：
```bash
git add src/roles src/app/app.module.ts
git commit -m "feat: 新增角色模块增删改查接口"
```

---

### Task 3: 用户查询接口返回角色

**Files:**
- Modify: `src/users/users.service.ts`（注入 Role 仓库，findById 附加 role）
- Modify: `src/users/users.service.spec.ts`（新增用例 + Role mock）
- Modify: `src/users/users.e2e-spec.ts`（provider 加 Role mock + 新增用例）

**Interfaces:**
- Consumes: `RoleInfo`（Task 1，`src/roles/role.entity.ts`）
- Produces: `UsersService.findById(id): Promise<User & { role: RoleInfo | null }>`

- [ ] **Step 1: 编写失败的单元测试**

`src/users/users.service.spec.ts` 修改：
1. import 加 `import { Role } from '../roles/role.entity'`
2. provider 加 `{ provide: getRepositoryToken(Role), useValue: roleRepo }`，`const roleRepo = { findOne: jest.fn() }`
3. 新增用例：

```ts
  describe('findById 返回角色', () => {
    it('用户带 roleId 时返回 { id, name, roleKey }', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, roleId: 5, delFlag: 0 })
      roleRepo.findOne.mockResolvedValue({ id: 5, name: '管理员', roleKey: 'admin' })

      const result = await service.findById(1)

      expect(result).toMatchObject({
        id: 1,
        role: { id: 5, name: '管理员', roleKey: 'admin' },
      })
      expect(roleRepo.findOne).toHaveBeenCalledWith({
        where: { id: 5, delFlag: 0 },
      })
    })

    it('roleId 为空时不查询角色，role 为 null', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, roleId: null, delFlag: 0 })

      const result = await service.findById(1)

      expect(result.role).toBeNull()
      expect(roleRepo.findOne).not.toHaveBeenCalled()
    })

    it('角色已被删除时 role 为 null', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, roleId: 5, delFlag: 0 })
      roleRepo.findOne.mockResolvedValue(null)

      const result = await service.findById(1)

      expect(result.role).toBeNull()
    })
  })
```

- [ ] **Step 2: 运行测试验证失败**

运行：`pnpm test -- users.service.spec.ts`
预期：`roleRepo is not defined` 或 `result.role` undefined 导致失败。

- [ ] **Step 3: 实现 findById 返回角色**

`src/users/users.service.ts` 修改：
1. import 加 `import { Role, RoleInfo } from '../roles/role.entity'`
2. 构造函数注入 Role 仓库：

```ts
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
```

3. `findById` 改为：

```ts
  async findById(id: number): Promise<User & { role: RoleInfo | null }> {
    const user: User | null = await this.userRepo.findOne({
      where: { id, delFlag: 0 },
    })
    if (!user) {
      throw new AppError(ErrorCodes.BIZ_ERROR, `用户 ${id} 不存在`)
    }
    return { ...user, role: await this.findRole(user.roleId) }
  }

  // 查询用户角色简要信息，无角色或角色已删除返回 null
  private async findRole(roleId: number | null): Promise<RoleInfo | null> {
    if (!roleId) {
      return null
    }
    const role = await this.roleRepo.findOne({ where: { id: roleId, delFlag: 0 } })
    if (!role) {
      return null
    }
    return { id: role.id, name: role.name, roleKey: role.roleKey }
  }
```

- [ ] **Step 4: 更新 users.e2e-spec.ts**

`src/users/users.e2e-spec.ts` 修改：
1. import 加 `import { Role } from '../roles/role.entity'`
2. `const userRepo = { findOne: jest.fn() }` 后加 `const roleRepo = { findOne: jest.fn() }`
3. provider 加 `{ provide: getRepositoryToken(Role), useValue: roleRepo }`
4. 现有用例「GET /users/1 成功」断言不变（user mock 无 roleId → role: null，`toEqual` 会因多出 `role` 字段失败！需把断言改为 `toMatchObject` 或在 user mock 里补 roleId: null）

现有断言 `expect(body).toEqual({ code: 0, message: 'ok', data: user })` —— 返回的 data 会是 `{ ...user, role: null }`，toEqual 精确匹配会失败。改为：

```ts
    const user = { id: 1, nickname: '甄嬛', delFlag: 0 }
    userRepo.findOne.mockResolvedValue(user)

    const res = await request(httpServer).get('/users/1').expect(200)
    const body = res.body as { code: number; message: string; data: unknown }

    expect(body).toEqual({ code: 0, message: 'ok', data: { ...user, role: null } })
```

5. 新增用例：

```ts
  it('GET /users/1 用户带角色：data.role 返回 { id, name, roleKey }', async () => {
    userRepo.findOne.mockResolvedValue({ id: 1, nickname: '甄嬛', roleId: 5 })
    roleRepo.findOne.mockResolvedValue({ id: 5, name: '管理员', roleKey: 'admin' })

    const res = await request(httpServer).get('/users/1').expect(200)
    const body = res.body as {
      code: number
      data: { role: { id: number; name: string; roleKey: string } }
    }

    expect(body.code).toBe(0)
    expect(body.data.role).toEqual({ id: 5, name: '管理员', roleKey: 'admin' })
  })
```

- [ ] **Step 5: 运行测试验证通过**

运行：`pnpm test -- users.service.spec.ts && pnpm test:e2e -- users.e2e-spec.ts`
预期：全部 PASS。

- [ ] **Step 6: Commit**

遵循 git-conventions（提交前经用户确认）：
```bash
git add src/users
git commit -m "feat: 用户查询接口返回角色信息"
```

---

### Task 4: 登录接口返回角色

**Files:**
- Modify: `src/auth/auth.service.ts`（注入 Role 仓库，login 附加 role）
- Modify: `src/auth/auth.service.spec.ts`（新增用例 + Role mock）
- Modify: `src/auth/auth.e2e-spec.ts`（provider 加 Role mock + 新增用例）

**Interfaces:**
- Consumes: `RoleInfo`（Task 1）
- Produces: `AuthService.login` 返回 `{ access_token, user: { ...user, role: RoleInfo | null } }`

- [ ] **Step 1: 编写失败的单元测试**

`src/auth/auth.service.spec.ts` 修改：
1. import 加 `import { Role } from '../roles/role.entity'`
2. 顶层加 `const roleRepoMock = { findOne: jest.fn() }`
3. provider 加 `{ provide: getRepositoryToken(Role), useValue: roleRepoMock }`
4. 现有 `buildUser` 默认值无需改（无 roleId → 不查角色，现有用例不受影响，登录返回 `role: null`）
5. 新增用例：

```ts
  it('登录成功：用户带角色时返回 role 简要信息', async () => {
    userRepoMock.findOne.mockResolvedValue(buildUser({ roleId: 5 }))
    roleRepoMock.findOne.mockResolvedValue({
      id: 5,
      name: '管理员',
      roleKey: 'admin',
    })
    jwtMock.signAsync.mockResolvedValue('access-token')
    redisMock.set.mockResolvedValue(undefined)
    userRepoMock.update.mockResolvedValue({ affected: 1 })

    const result = await service.login(
      {
        email: 'admin@example.com',
        password: '123456',
        captchaId: 'id',
        captchaCode: '1234',
      },
      '127.0.0.1',
    )

    expect(roleRepoMock.findOne).toHaveBeenCalledWith({
      where: { id: 5, delFlag: 0 },
    })
    expect(result.user).toMatchObject({
      role: { id: 5, name: '管理员', roleKey: 'admin' },
    })
  })

  it('登录成功：用户无角色时 role 为 null', async () => {
    userRepoMock.findOne.mockResolvedValue(buildUser())
    jwtMock.signAsync.mockResolvedValue('access-token')
    redisMock.set.mockResolvedValue(undefined)
    userRepoMock.update.mockResolvedValue({ affected: 1 })

    const result = await service.login(
      {
        email: 'admin@example.com',
        password: '123456',
        captchaId: 'id',
        captchaCode: '1234',
      },
      '127.0.0.1',
    )

    expect(result.user).toMatchObject({ role: null })
    expect(roleRepoMock.findOne).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: 运行测试验证失败**

运行：`pnpm test -- auth.service.spec.ts`
预期：`roleRepoMock is not defined` 或 `result.user.role` 为 undefined 导致失败。

- [ ] **Step 3: 实现 login 返回角色**

`src/auth/auth.service.ts` 修改：
1. import 加 `import { Role, RoleInfo } from '../roles/role.entity'`
2. 构造函数注入：

```ts
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
```

3. `login` 中构造返回前加：

```ts
    const role = await this.findRole(user.roleId)
```

并把返回改为：

```ts
    const { password: _password, ...userWithoutPassword } = user
    void _password
    return { access_token: accessToken, user: { ...userWithoutPassword, role } }
```

4. 新增私有方法（与 users.service 的 findRole 逻辑一致）：

```ts
  // 查询用户角色简要信息，无角色或角色已删除返回 null
  private async findRole(roleId: number | null): Promise<RoleInfo | null> {
    if (!roleId) {
      return null
    }
    const role = await this.roleRepo.findOne({ where: { id: roleId, delFlag: 0 } })
    if (!role) {
      return null
    }
    return { id: role.id, name: role.name, roleKey: role.roleKey }
  }
```

- [ ] **Step 4: 更新 auth.e2e-spec.ts**

`src/auth/auth.e2e-spec.ts` 修改：
1. import 加 `import { Role } from '../roles/role.entity'`
2. `const userRepo = { findOne: jest.fn(), update: jest.fn() }` 后加 `const roleRepo = { findOne: jest.fn() }`
3. provider 加 `{ provide: getRepositoryToken(Role), useValue: roleRepo }`
4. 现有 `mockUser()` 无 roleId → 登录不查角色，现有用例不受影响（响应多出 `role: null` 字段，现有断言均未断言 user 的完整形状，可过）
5. 新增用例：

```ts
  it('登录：用户带角色时返回 role 简要信息', async () => {
    userRepo.findOne.mockResolvedValue({ ...mockUser(), roleId: 5 })
    userRepo.update.mockResolvedValue({ affected: 1 })
    roleRepo.findOne.mockResolvedValue({
      id: 5,
      name: '管理员',
      roleKey: 'admin',
    })

    const res = await request(httpServer).post('/auth/login').send({
      email: 'admin@example.com',
      password: '123456',
      captchaId: 'captcha-id',
      captchaCode: '1234',
    })

    expect(res.status).toBe(200)
    const body = res.body as {
      code: number
      data: { user: { role: { id: number; name: string; roleKey: string } | null } }
    }
    expect(body.code).toBe(0)
    expect(body.data.user.role).toEqual({
      id: 5,
      name: '管理员',
      roleKey: 'admin',
    })
  })
```

- [ ] **Step 5: 运行测试验证通过**

运行：`pnpm test -- auth.service.spec.ts && pnpm test:e2e -- auth.e2e-spec.ts`
预期：全部 PASS。

- [ ] **Step 6: Commit**

遵循 git-conventions（提交前经用户确认）：
```bash
git add src/auth
git commit -m "feat: 登录接口返回角色信息"
```

---

### Task 5: 全量验证与收尾

**Files:** 无（仅验证）

- [ ] **Step 1: 全量测试与构建**

运行：`pnpm lint && pnpm test && pnpm test:e2e && pnpm build`
预期：全部通过，无 lint 告警。

- [ ] **Step 2: 补充设计文档的代码结构与实际一致**

核对 `docs/superpowers/specs/2026-08-22-role-module-design.md` 与实现无出入（接口路径、字段、错误文案）。如需微调文档，直接更新并纳入提交。

- [ ] **Step 3: Commit（如有文档改动）**

遵循 git-conventions（提交前经用户确认）：
```bash
git add docs/superpowers/specs/2026-08-22-role-module-design.md
git commit -m "docs: 同步角色模块设计文档与实现一致"
```
