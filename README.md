# nest-practices

NestJS 实践。

## 技术栈

- **框架**: NestJS 11 + Express
- **语言**: TypeScript 5.7
- **包管理**: pnpm
- **测试**: Jest + supertest
- **代码规范**: ESLint + Prettier

## 快速开始

```bash
pnpm install
pnpm start:dev    # 开发模式，默认 http://localhost:3000
```

## 可用命令

| 命令              | 说明               |
| ----------------- | ------------------ |
| `pnpm start:dev`  | 开发模式（热重载） |
| `pnpm build`      | 生产构建           |
| `pnpm start:prod` | 运行构建产物       |
| `pnpm lint`       | ESLint 检查并修复  |
| `pnpm format`     | Prettier 格式化    |
| `pnpm test`       | 单元测试           |
| `pnpm test:e2e`   | E2E 测试           |
| `pnpm test:cov`   | 测试覆盖率         |
