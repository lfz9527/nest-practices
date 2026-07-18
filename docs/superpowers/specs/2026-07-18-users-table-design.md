# 用户表设计

**日期**: 2026-07-18

## 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| id | BIGINT UNSIGNED | 用户ID（主键） |
| nickname | VARCHAR(30) | 用户昵称 |
| email | VARCHAR(100) | 用户邮箱（唯一） |
| gender | TINYINT | 性别: 0=男 1=女 2=未知 |
| avatar | VARCHAR(255) | 头像路径 |
| password | VARCHAR(255) | 密码（加密存储） |
| status | TINYINT | 账号状态: 0=正常 1=停用 |
| del_flag | TINYINT | 删除标志: 0=存在 2=删除 |
| last_login_ip | VARCHAR(45) | 最后登录IP |
| last_login_time | DATETIME | 最后登录时间 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |
| remark | VARCHAR(255) | 备注 |

## DDL

```sql
-- ============================================
-- 表名: 用户表
-- 说明: 存储系统用户基本信息，支持软删除
-- ============================================
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    `nickname` VARCHAR(30) NOT NULL DEFAULT '' COMMENT '用户昵称',
    `email` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '用户邮箱',
    `gender` TINYINT NOT NULL DEFAULT 2 COMMENT '用户性别: 0=男 1=女 2=未知',
    `avatar` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '头像路径',
    `password` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '密码（加密存储）',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '账号状态: 0=正常 1=停用',
    `del_flag` TINYINT NOT NULL DEFAULT 0 COMMENT '删除标志: 0=存在 2=删除',
    `last_login_ip` VARCHAR(45) NOT NULL DEFAULT '' COMMENT '最后登录IP',
    `last_login_time` DATETIME DEFAULT NULL COMMENT '最后登录时间',
    `remark` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_email` (`email`),
    KEY `idx_status` (`status`),
    KEY `idx_del_flag` (`del_flag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
```

### 范式检查

- **1NF**: 所有字段均为原子值，无逗号分隔或可拆分的复合字段 ✅
- **2NF**: 单列自增主键，天然满足 ✅
- **3NF**: 所有非主键字段直接依赖主键，无传递依赖 ✅

### 索引说明

| 索引 | 字段 | 用途 |
|---|---|---|
| PRIMARY | id | 主键查询 |
| uk_email | email | 登录/注册时邮箱唯一性校验 |
| idx_status | status | 按账号状态筛选（启用/停用） |
| idx_del_flag | del_flag | 软删除过滤，几乎每条查询都带 `WHERE del_flag = 0` |
