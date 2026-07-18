# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 技术栈

- **框架**: NestJS 11 + Express
- **语言**: TypeScript 5.7（NodeNext 模块解析，target ES2023）
- **包管理**: pnpm
- **测试**: Jest 30 + ts-jest + supertest（E2E）
- **代码规范**: ESLint 9 flat config + Prettier 3

## 常用命令

```bash
pnpm start:dev        # 开发模式（热重载，默认端口 3000）
pnpm build            # 生产构建 → dist/
pnpm start:prod       # 运行构建产物（node dist/main）
pnpm lint             # ESLint 检查并自动修复
pnpm format           # Prettier 格式化 src/ 和 test/
pnpm test             # 运行单元测试
pnpm test:e2e         # 运行 E2E 测试
pnpm test:cov         # 运行测试并生成覆盖率报告
```

## 架构概览

标准的 NestJS 三层架构，当前仅有默认脚手架模块：

- `src/main.ts` — 入口，创建 NestFactory 并监听 `process.env.PORT ?? 3000`
- `src/app.module.ts` — 根模块，注册 Controller 和 Provider
- `src/app.controller.ts` — 根路由 `GET /`，返回 `appService.getHello()`
- `src/app.service.ts` — 业务逻辑，目前仅返回 `'Hello World!'`

### 测试

- 单元测试位于 `src/` 内，文件名匹配 `*.spec.ts`，`rootDir: "src"`
- E2E 测试位于 `test/`，文件名匹配 `*.e2e-spec.ts`，使用独立配置文件 `test/jest-e2e.json`
- 测试工具: `@nestjs/testing` + `supertest`

### 代码规范要点

- 分号可选（`semi: false`），单引号，尾逗号，换行符 LF
- `@typescript-eslint/no-explicit-any` 已关闭
- editor.formatOnSave + ESLint auto-fix 已配置在 `.vscode/settings.json`
- ESLint 开启类型检查规则（`recommendedTypeChecked`），使用 `projectService: true` 自动发现 tsconfig
