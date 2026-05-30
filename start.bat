@echo off
echo ========================================
echo   医院导诊系统启动脚本
echo ========================================
echo.

echo [1/3] 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)
echo ✓ Node.js 已安装

echo.
echo [2/3] 安装依赖包...
call npm install
if errorlevel 1 (
    echo 错误: 依赖安装失败
    pause
    exit /b 1
)
echo ✓ 依赖安装完成

echo.
echo [3/3] 启动服务器...
echo.
echo 访问地址:
echo   - 聊天端: http://localhost:3000/chat.html
echo   - 管理后台: http://localhost:3000/admin/login.html
echo.
echo 默认管理员账户:
echo   用户名: admin
echo   密码: admin123
echo.

npm start

pause
