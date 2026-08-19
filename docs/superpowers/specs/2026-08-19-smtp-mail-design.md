# SMTP 单封纯文本邮件发送设计

## 1. 目标

新增可复用的 `MailModule`，提供受 JWT 保护的 `POST /mail/send` 接口，用 SMTP 发送单封纯文本邮件。接口响应遵循项目现有统一响应与异常规范。

## 2. 模块结构

新增 `src/mail/` 模块：

- `mail.module.ts`：声明并导出邮件模块与服务。
- `mail.controller.ts`：提供 HTTP 发送接口。
- `mail.service.ts`：封装 SMTP 配置读取与邮件发送。
- `dto/send-mail.dto.ts`：定义并校验发送请求。
- 对应单元测试文件。

`AppModule` 导入 `MailModule`，`MailService` 对外导出，便于后续验证码、系统通知等业务复用。

## 3. SMTP 配置

`config.yaml` 增加 `mail.smtp` 配置。每个配置项都添加中文注释，说明用途、端口或加密要求；真实密码或授权码不得提交到仓库，应通过部署配置或环境变量注入。

配置字段：

- `host`：SMTP 服务器地址。
- `port`：SMTP 服务端口，常见为 465 或 587。
- `secure`：是否启用 SSL/TLS，465 通常为 `true`。
- `user`：SMTP 登录账号，通常为发件人邮箱。
- `pass`：SMTP 登录密码或授权码，不保存真实凭据。
- `from`：默认发件人地址。

## 4. HTTP 接口

### `POST /mail/send`

接口不标记 `@Public()`，沿用全局 JWT 守卫。

请求体：

- `to`：单个合法邮箱地址。
- `subject`：非空邮件主题，限制最大长度。
- `text`：非空纯文本正文，限制最大长度。

第一版不支持 HTML、抄送、密送和附件。

Controller 仅负责接收 DTO 并调用 `MailService.sendTextMail()`，不暴露 SMTP 实现细节。

## 5. 服务与错误处理

`MailService` 从 `ConfigService` 读取 SMTP 配置，创建 transporter，并发送 `from`、`to`、`subject`、`text` 字段。

配置缺失或 SMTP 发送失败时，转换为项目统一的 `AppError`，向调用方返回固定中文业务错误，不泄露底层 SMTP 响应、账号密码或错误堆栈。未知异常继续交由现有全局错误处理链路处理。

## 6. 测试与验收

覆盖以下场景：

- DTO 缺少字段、非法邮箱、空主题、空正文和长度边界。
- Service 正确映射 SMTP 配置并成功发送。
- Service 将发送失败转换为统一业务错误且不泄露底层错误内容。
- Controller 将请求委托给 Service 并返回发送结果。

使用 mock transporter 验证逻辑，不依赖真实 SMTP 服务。实现后运行：

```bash
pnpm test
pnpm build
pnpm lint
```
