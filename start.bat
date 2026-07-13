@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════╗
echo ║   你该打工还是创业？- 测试系统     ║
echo ╚══════════════════════════════════════╝
echo.
echo 启动中...
echo.
node "%~dp0server\server.js"
pause
