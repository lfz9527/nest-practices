@echo off
:: UAC 自提权：双击运行时自动请求管理员权限，授权后新窗口以管理员执行
net session >nul 2>&1
if %errorLevel% equ 0 goto :admin
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
if %errorLevel% neq 0 (
    echo [错误] 未获得管理员授权，请在弹出的 UAC 窗口点击"是"
)
pause
exit /b 1

:admin
echo ========================================
echo    Redis 端口转发自动配置脚本
echo ========================================
echo.

:: 获取 WSL 内 Redis 的 IP（WSL 每次重启后 IP 会变化，动态获取）
echo 正在获取 WSL IP...
for /f %%i in ('wsl hostname -I') do set WSLIP=%%i
if "%WSLIP%"=="" (
    echo [错误] 无法获取 WSL IP，请确认 WSL 已启动！
    pause
    exit /b 1
)
echo 检测到 WSL IP: %WSLIP%

:: 清除旧的端口转发规则
echo [1/4] 清除旧的端口转发规则...
netsh interface portproxy reset
if %errorLevel% neq 0 (
    echo [警告] 清除旧规则失败，继续执行...
)

:: 添加新的端口转发规则
echo [2/4] 添加端口转发规则...
netsh interface portproxy add v4tov4 listenport=6379 listenaddress=127.0.0.1 connectport=6379 connectaddress=%WSLIP%
if %errorLevel% neq 0 (
    echo [错误] 添加端口转发规则失败！
    pause
    exit /b 1
)

:: 重启 IP Helper 服务
echo [3/4] 重启 IP Helper 服务...
net stop iphlpsvc >nul 2>&1
net start iphlpsvc >nul 2>&1

:: 测试 Redis 连接（AUTH 密码与 config.yaml 的 redis.password 一致：root）
echo [4/4] 测试 Redis 连接...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$c = New-Object System.Net.Sockets.TcpClient; ^
try { ^
  $c.Connect('127.0.0.1', 6379); ^
  $s = $c.GetStream(); ^
  $crlf = [string][char]13 + [char]10; ^
  $auth = @('*2', '$4', 'AUTH', '$4', 'root') -join $crlf; ^
  $b = [System.Text.Encoding]::UTF8.GetBytes($auth + $crlf); ^
  $s.Write($b, 0, $b.Length); ^
  $ping = @('*1', '$4', 'PING') -join $crlf; ^
  $b2 = [System.Text.Encoding]::UTF8.GetBytes($ping + $crlf); ^
  $s.Write($b2, 0, $b2.Length); ^
  $s.Flush(); ^
  Start-Sleep -Milliseconds 500; ^
  $buf = New-Object byte[] 128; ^
  $n = $s.Read($buf, 0, 128); ^
  $resp = [System.Text.Encoding]::UTF8.GetString($buf, 0, $n); ^
  if ($resp -match 'PONG') { Write-Output '测试通过：Redis 连接正常' } ^
  else { Write-Output ('测试失败：Redis 响应异常 -^> ' + $resp) } ^
} catch { ^
  Write-Output ('测试失败：无法连接 127.0.0.1:6379 -^> ' + $_.Exception.Message) ^
} finally { ^
  $c.Close() ^
}"

echo.
echo ========================================
echo    配置完成！请测试连接：
echo    redis-cli -h 127.0.0.1 -p 6379 -a root ping
echo ========================================
echo.
pause
