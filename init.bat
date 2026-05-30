@echo off
echo ========================================
echo   医院导诊系统 - 数据库初始化
echo ========================================
echo.

echo [1/2] 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)
echo ✓ Node.js 已安装

echo.
echo [2/2] 安装依赖...
call npm install
if errorlevel 1 (
    echo 错误: 依赖安装失败
    pause
    exit /b 1
)

echo.
echo 开始初始化数据库...
call npm run init-db

echo.
echo ========================================
echo   初始化完成！
echo ========================================
echo.
echo 下一步:
echo 1. 修改 .env 文件配置数据库连接
echo 2. 运行 start.bat 启动服务器
echo.
pause
