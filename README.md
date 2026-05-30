# 医院导诊小程序系统

## 项目简介

这是一个完整的医院导诊小程序前后端分离系统，包含微信公众号聊天端和后台管理系统。

## 功能特性

### 微信公众号聊天端
- 响应式界面设计，适配微信环境
- 语音输入与识别
- 图片上传功能
- 多轮对话上下文记忆
- 历史对话持久化存储
- 对话历史管理（删除、批量删除、复制）
- 快捷问题按钮
- 智能回复系统

### 后台管理系统
- 用户认证与基于角色的权限控制
- 实时数据看板
- 今日用户问题列表（分页、搜索）
- 访问人数统计与可视化
- 高频问题智能统计（向量聚合与语义匹配）
- 一键将热点问题加入知识库
- 高频问题管理（修改、删除）
- 知识库管理（文档录入、图片上传、版本控制）
- 操作日志记录

## 技术栈

### 后端
- Node.js + Express
- MySQL 数据库
- JWT 身份认证
- Multer 文件上传
- bcryptjs 密码加密

### 前端
- HTML5 + CSS3 + JavaScript
- 响应式设计
- 原生 JavaScript（无框架依赖）

## 安装步骤

### 1. 安装 Node.js
确保已安装 Node.js (v14+) 和 npm

### 2. 安装 MySQL
创建数据库（如果不存在，初始化脚本会自动创建）

### 3. 配置环境变量
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下内容：
```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hospital_guidance
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
```

### 4. 安装依赖
```bash
npm install
```

### 5. 初始化数据库
```bash
npm run init-db
```

这将创建所有必要的表和默认管理员账户：
- 用户名: `admin`
- 密码: `admin123`

### 6. 启动服务器
```bash
npm start
```

服务器将在 http://localhost:3000 启动

## 访问地址

- 聊天端: http://localhost:3000/chat.html
- 管理后台登录: http://localhost:3000/admin/login.html
- 管理后台主页: http://localhost:3000/admin/dashboard.html

## API 接口

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/change-password` - 修改密码
- `GET /api/auth/profile` - 获取用户信息

### 聊天接口
- `POST /api/chat/message` - 发送消息
- `GET /api/chat/history/:openid` - 获取历史记录
- `DELETE /api/chat/conversation/:sessionId` - 删除单条对话
- `DELETE /api/chat/batch-delete` - 批量删除对话
- `POST /api/chat/upload/image` - 上传图片
- `POST /api/chat/upload/voice` - 上传语音

### 管理后台接口
- `GET /api/admin/dashboard/today-questions` - 今日问题列表
- `GET /api/admin/dashboard/stats` - 统计数据
- `GET /api/admin/frequent-questions` - 高频问题列表
- `POST /api/admin/frequent-questions/add-to-knowledge-base` - 添加到知识库
- `GET /api/admin/users` - 用户列表
- `GET /api/admin/logs` - 操作日志

### 知识库接口
- `GET /api/knowledge-base` - 知识库列表
- `GET /api/knowledge-base/:id` - 知识库详情
- `POST /api/knowledge-base` - 创建知识库条目
- `PUT /api/knowledge-base/:id` - 更新知识库条目
- `DELETE /api/knowledge-base/:id` - 删除知识库条目
- `POST /api/knowledge-base/batch-update` - 批量更新
- `POST /api/knowledge-base/upload` - 上传文件
- `GET /api/knowledge-base/version/:id/:version` - 获取历史版本
- `POST /api/knowledge-base/rollback/:id/:version` - 回滚版本

## 数据库表结构

### users - 用户表
存储管理员和操作员账户信息

### user_sessions - 用户会话表
存储微信用户的会话信息

### conversations - 对话记录表
存储所有对话消息

### knowledge_base - 知识库表
存储问答知识库内容

### knowledge_versions - 知识库版本表
存储知识库的版本历史

### question_stats - 问题统计表
存储高频问题统计数据

### daily_stats - 每日统计表
存储每日访问统计数据

### admin_logs - 管理日志表
存储管理员操作日志

## 权限说明

系统支持三种角色：
- `admin` - 管理员（全部权限）
- `doctor` - 医生（知识库编辑权限）
- `operator` - 操作员（查看权限）

## 目录结构

```
hospital-guidance-system/
├── config/
│   └── database.js          # 数据库配置
├── middleware/
│   └── auth.js              # 认证中间件
├── public/
│   ├── chat.html            # 聊天端页面
│   └── admin/
│       ├── login.html       # 登录页面
│       └── dashboard.html  # 管理后台页面
├── routes/
│   ├── auth.js              # 认证路由
│   ├── chat.js              # 聊天路由
│   ├── admin.js             # 管理后台路由
│   └── knowledgeBase.js     # 知识库路由
├── scripts/
│   └── initDatabase.js      # 数据库初始化脚本
├── uploads/                 # 上传文件目录
├── server.js                # 主服务器文件
├── package.json             # 项目配置
└── .env.example             # 环境变量示例
```

## 安全建议

1. 生产环境请修改默认管理员密码
2. 使用 HTTPS 加密传输
3. 合理设置 JWT 过期时间
4. 定期备份数据库
5. 敏感操作记录日志

## 开发说明

前端页面完全独立，可直接部署到 CDN 或静态服务器。
后端 API 可独立部署，支持跨域调用。

## 默认账户

- 用户名: `admin`
- 密码: `admin123`
- 角色: `admin`

## License

MIT
