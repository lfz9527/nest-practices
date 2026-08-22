-- ============================================
-- nest-practices 数据库初始化脚本
-- 注意：列名与 TypeORM 实体一致（默认命名策略，驼峰命名），勿改蛇形
-- ============================================

CREATE DATABASE IF NOT EXISTS nest_practices
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE nest_practices;

-- 用户表
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    `nickname` VARCHAR(30) NOT NULL DEFAULT '' COMMENT '用户昵称',
    `email` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '用户邮箱',
    `gender` TINYINT NOT NULL DEFAULT 2 COMMENT '用户性别: 0=男 1=女 2=未知',
    `avatar` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '头像路径',
    `password` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '密码（加密存储）',
    `roleId` BIGINT UNSIGNED DEFAULT NULL COMMENT '角色ID',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '账号状态: 0=正常 1=停用',
    `delFlag` TINYINT NOT NULL DEFAULT 0 COMMENT '删除标志: 0=存在 2=删除',
    `lastLoginIp` VARCHAR(45) NOT NULL DEFAULT '' COMMENT '最后登录IP',
    `lastLoginTime` DATETIME DEFAULT NULL COMMENT '最后登录时间',
    `remark` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_email_del_flag` (`email`, `delFlag`),
    KEY `idx_status` (`status`),
    KEY `idx_del_flag` (`delFlag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 初始用户（密码由应用层 bcryptjs 加密，请通过 pnpm seed 创建，勿直接执行此 INSERT；
-- 创建时自动绑定下方 admin 角色）
-- INSERT INTO `users` (`nickname`, `email`, `password`, `remark`) VALUES ('admin', 'admin@example.com', '<bcryptjs-hashed>', '初始管理员用户');

-- 角色表
CREATE TABLE `roles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色ID',
    `name` VARCHAR(30) NOT NULL DEFAULT '' COMMENT '角色名称',
    `roleKey` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '角色编码',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '角色状态: 0=正常 1=停用',
    `sort` INT NOT NULL DEFAULT 0 COMMENT '显示顺序',
    `remark` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
    `delFlag` TINYINT NOT NULL DEFAULT 0 COMMENT '删除标志: 0=存在 2=删除',
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_role_key_del_flag` (`roleKey`, `delFlag`),
    KEY `idx_del_flag` (`delFlag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- 默认角色：超级管理员（与 pnpm seed 的 INIT_ROLE 保持一致，重复执行由唯一约束拦截）
INSERT INTO `roles` (`name`, `roleKey`) VALUES ('超级管理员', 'admin');
