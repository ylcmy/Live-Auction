# Render 部署指南

## 架构说明

采用**单服务部署**策略：后端（Fastify）在 production 模式下同时 serve 前端静态文件，只需一个 Web Service。

```
┌─────────────────────────────────────┐
│          Render Web Service          │
│  ┌─────────┐    ┌────────────────┐  │
│  │ Fastify  │───▶│ 前端 dist/     │  │
│  │ (API+WS) │    │ (静态文件)     │  │
│  └─────────┘    └────────────────┘  │
│       │                              │
│  :3001 (API + WebSocket + 静态)     │
└───────┼──────────────────────────────┘
        │
   ┌────┴────┐    ┌─────────┐
   │  MySQL   │    │  Redis  │
   │ (Render) │    │(Render) │
   └─────────┘    └─────────┘
```

## 前置准备

1. 注册 [Render](https://render.com) 账号（支持 GitHub 登录）
2. 将项目推送到 GitHub 仓库

## 部署步骤

### Step 1: 创建 MySQL 数据库

1. Render Dashboard → **New** → **Private Service**
2. 设置：
   - **Name**: `live-auction-mysql`
   - **Image**: `mysql:8`（Docker Hub）
   - **Plan**: Free
   - **Region**: Singapore（或就近区域）
3. 添加环境变量：
   - `MYSQL_ROOT_PASSWORD` = 你设置一个强密码
   - `MYSQL_DATABASE` = `live_auction`
4. 创建后，记录服务的 **Internal Hostname**（类似 `live-auction-mysql:port`）

> ⚠️ **Render 免费层 MySQL 注意事项：**
> - 免费 Private Service 会在 15 分钟无请求后休眠，冷启动约 30-60 秒
> - 如果觉得体验不好，可以考虑升级到 $7/月的 Standard 实例
> - 或使用外部免费 MySQL（如 [TiDB Cloud](https://tidbcloud.com) 免费层）

### Step 2: 创建 Redis 缓存

1. Render Dashboard → **New** → **Redis**
2. 设置：
   - **Name**: `live-auction-redis`
   - **Plan**: Free（25MB，不会过期）
   - **Region**: 与 MySQL 相同
3. 创建后，Render 会自动注入 `REDIS_URL` 到关联服务

### Step 3: 部署 Web Service

1. Render Dashboard → **New** → **Web Service**
2. 连接 GitHub 仓库
3. 设置：
   - **Name**: `live-auction`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Plan**: Free
   - **Region**: 与数据库相同
4. 添加环境变量：

   | 变量 | 值 | 说明 |
   |------|-----|------|
   | `NODE_ENV` | `production` | 生产模式 |
   | `JWT_SECRET` | `openssl rand -hex 32` 生成 | ≥32 字符 |
   | `DB_HOST` | MySQL 的 Internal Hostname | 如 `live-auction-mysql` |
   | `DB_PORT` | `3306` | MySQL 端口 |
   | `DB_USER` | `root` | MySQL 用户 |
   | `DB_PASSWORD` | 你在 Step 1 设置的密码 | MySQL 密码 |
   | `DB_NAME` | `live_auction` | 数据库名 |
   | `CORS_ORIGINS` | 服务部署后的 URL | 如 `https://live-auction.onrender.com` |
   | `BCRYPT_COST` | `12` | 密码哈希强度 |

   > Redis 的 `REDIS_URL` 会由 Render 自动注入（如果在同区域）

5. 点击 **Create Web Service**，等待构建和部署

### Step 4: 验证部署

1. 访问 `https://your-service.onrender.com/api/health`，确认返回 `healthy`
2. 访问 `https://your-service.onrender.com`，确认前端页面加载
3. 使用种子数据中的测试账号登录：
   - 商家: `merchant_1` / `merchant123`
   - 用户: `user_1` / `user123`

### Step 5: 初始化数据（可选）

首次部署后，数据库是空的。可以通过以下方式初始化：

1. SSH 到 Render 服务（Dashboard → Shell）
2. 运行种子数据命令：
   ```bash
   cd /app/backend
   tsx src/infrastructure/db/seeds/run.ts
   ```

## 常见问题

### 冷启动慢？

Render 免费层会在 15 分钟无活动后休眠，首次请求需要 30-60 秒唤醒。可以：
- 使用 [UptimeRobot](https://uptimerobot.com) 每 5 分钟 ping `/api/health`
- 或升级到付费层

### 数据库连接超时？

确保 MySQL Private Service 和 Web Service 在同一 Region。

### CORS 报错？

确保 `CORS_ORIGINS` 环境变量设置为 Web Service 的完整 URL，例如：
`https://live-auction.onrender.com`

### WebSocket 连不上？

Render 免费层支持 WebSocket，但冷启动后首次连接可能较慢。检查：
1. 浏览器控制台是否有连接错误
2. 服务日志是否有 WS 连接记录

## 本地 Docker 测试

在推送到 Render 之前，可以本地测试 Docker 构建：

```bash
# 构建镜像
docker build -t live-auction .

# 运行（需要先启动 MySQL 和 Redis）
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e JWT_SECRET=test-secret-at-least-32-chars-long \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=3306 \
  -e DB_USER=root \
  -e DB_PASSWORD=root123 \
  -e DB_NAME=live_auction \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e CORS_ORIGINS=http://localhost:3001 \
  live-auction
```

然后访问 `http://localhost:3001` 验证。
