#!/usr/bin/env bash
# 将 WSL 内 Redis 转发到 Windows 127.0.0.1:6379（需管理员权限运行）
# WSL 每次重启后 IP 会变化，重跑本脚本即可

set -e

# 检测当前是否为管理员（非管理员执行 netsh 会因权限失败）
if ! net session >/dev/null 2>&1; then
  echo "请以管理员身份运行 Git Bash 后重试 pnpm redis:link" >&2
  exit 1
fi

WSLIP=$(wsl hostname -I | awk '{print $1}')
if [ -z "$WSLIP" ]; then
  echo "无法获取 WSL IP，请确认 WSL 已启动" >&2
  exit 1
fi

netsh interface portproxy delete v4tov4 listenaddress=127.0.0.1 listenport=6379 2>/dev/null || true
netsh interface portproxy add v4tov4 listenaddress=127.0.0.1 listenport=6379 connectaddress="$WSLIP" connectport=6379
echo "portproxy 已配置: 127.0.0.1:6379 -> $WSLIP:6379"
