-- ============================================
-- nest-practices 数据库初始化脚本
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

-- 初始用户（密码由应用层 bcryptjs 加密，请通过 pnpm seed 创建，勿直接执行此 INSERT）
-- INSERT INTO `users` (`nickname`, `email`, `password`, `remark`) VALUES ('admin', 'admin@example.com', '<bcryptjs-hashed>', '初始管理员用户');
