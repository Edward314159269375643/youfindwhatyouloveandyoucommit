# 部署上线指南

## 一、准备工作

### 1. 注册微信公众号
1. 访问 [微信公众平台](https://mp.weixin.qq.com/)
2. 注册**服务号**（需要企业资质）或**订阅号**
3. 完成认证（可选，认证后功能更多）

### 2. 准备域名和服务器
- **域名**：需要一个已备案的域名（微信要求）
- **SSL证书**：必须 HTTPS（微信要求）

---

## 二、部署到云平台

### 方案 A：Vercel 部署（推荐新手）

#### 步骤 1：安装 Vercel CLI
```bash
npm install -g vercel
```

#### 步骤 2：登录 Vercel
```bash
vercel login
```

#### 步骤 3：部署项目
```bash
cd d:\练习ing\1
vercel
```

#### 步骤 4：配置环境变量
在 Vercel 控制台设置以下环境变量：
- `JWT_SECRET`：JWT 密钥
- `WECHAT_TOKEN`：微信公众号 Token
- `WECHAT_APP_ID`：微信公众号 AppID
- `WECHAT_APP_SECRET`：微信公众号 AppSecret

#### 步骤 5：绑定自定义域名
1. 在 Vercel 控制台 → Settings → Domains
2. 添加你的域名
3. 按提示配置 DNS 解析

---

### 方案 B：Railway 部署

#### 步骤 1：连接 GitHub
1. 访问 [Railway](https://railway.app/)
2. 使用 GitHub 登录
3. 授权 Railway 访问你的仓库

#### 步骤 2：创建新项目
1. 点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择你的仓库

#### 步骤 3：配置环境变量
在 Railway 控制台 → Variables 添加：
```
JWT_SECRET=your_secret_key
WECHAT_TOKEN=your_wechat_token
WECHAT_APP_ID=your_appid
WECHAT_APP_SECRET=your_appsecret
```

#### 步骤 4：绑定域名
1. Settings → Domains
2. 添加自定义域名
3. Railway 自动配置 HTTPS

---

### 方案 C：腾讯云开发（推荐微信生态）

#### 步骤 1：开通云开发
1. 登录 [腾讯云控制台](https://cloud.tencent.com/)
2. 开通「云开发」服务

#### 步骤 2：创建应用
1. 选择「Web 应用」
2. 上传项目代码
3. 自动分配域名（支持 HTTPS）

#### 步骤 3：配置环境变量
在云开发控制台设置环境变量

---

## 三、微信公众号配置

### 1. 配置服务器地址
登录微信公众平台 → 设置与开发 → 基本配置：

| 配置项 | 值 |
|--------|-----|
| 服务器地址(URL) | `https://your-domain.com/api/wechat` |
| Token | 自定义一个字符串（与 .env 中 WECHAT_TOKEN 一致） |
| 消息加解密方式 | 明文模式（测试）或安全模式（生产） |

### 2. 配置 JS 接口安全域名
设置与开发 → 公众号设置 → 功能设置：
- 添加你的域名（不带 https://）

### 3. 配置网页授权域名
设置与开发 → 公众号设置 → 功能设置：
- 添加你的域名（用于获取用户 openid）

### 4. 创建自定义菜单
访问 `https://your-domain.com/api/wechat/menu` 获取菜单配置 JSON

---

## 四、环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `PORT` | 服务端口 | `3000` |
| `JWT_SECRET` | JWT 密钥 | `your_secret_key` |
| `WECHAT_TOKEN` | 微信公众号 Token | `my_token_123` |
| `WECHAT_APP_ID` | 微信公众号 AppID | `wx1234567890` |
| `WECHAT_APP_SECRET` | 微信公众号 AppSecret | `abc123...` |
| `WECHAT_CHAT_URL` | 聊天页面 URL | `https://your-domain.com/chat.html` |

---

## 五、验证部署

### 1. 检查服务状态
访问：`https://your-domain.com/api/health`

应返回：
```json
{"status":"ok","timestamp":"..."}
```

### 2. 测试聊天功能
访问：`https://your-domain.com/chat.html`

### 3. 测试管理后台
访问：`https://your-domain.com/admin/login.html`
- 用户名：`admin`
- 密码：`admin123`

### 4. 测试微信接入
在微信公众平台点击「提交」按钮，验证服务器配置

---

## 六、常见问题

### Q1: 微信服务器配置验证失败？
- 检查 Token 是否与 .env 中一致
- 确保服务器已启动
- 确保域名已正确解析

### Q2: 无法获取用户 openid？
- 检查网页授权域名是否配置正确
- 确保使用 HTTPS

### Q3: 消息无法正常接收？
- 检查服务器日志
- 确认消息加解密配置正确

---

## 七、安全建议

1. **修改默认密码**：登录后台立即修改 admin 密码
2. **使用复杂密钥**：JWT_SECRET 使用 32 位以上随机字符串
3. **定期备份**：定期备份 SQLite 数据库文件
4. **开启日志**：记录关键操作日志

---

## 八、费用参考

| 平台 | 免费额度 | 超出费用 |
|------|----------|----------|
| Vercel | 100GB 带宽/月 | $20/月起 |
| Railway | $5/月免费额度 | 按用量计费 |
| 腾讯云开发 | 有免费额度 | 按用量计费 |

---

**部署完成后，请测试所有功能确保正常运行！**
