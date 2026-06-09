<div align="center">

# 「实时竞拍大师」

### 抖音电商直播竞拍全栈系统设计与实现

**基于现代 Web 技术栈构建的实时直播竞拍平台，灵感来源于抖音电商直播场景，提供毫秒级同步的竞价体验。**

[English](./README.md) | 中文

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-4.28-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Vitest](https://img.shields.io/badge/Vitest-2.1-729B1B?logo=vitest&logoColor=white)](https://vitest.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

</div>

***

## 📖 目录

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [依赖环境](#依赖环境)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [可用脚本](#可用脚本)
- [数据库设计](#数据库设计)
- [API 参考](#api-参考)
- [测试](#测试)
- [核心设计决策](#核心设计决策)
- [CI/CD](#cicd)
- [开源许可](#开源许可)

***

## 项目简介

「实时竞拍大师」是一个面向抖音电商直播场景的全栈竞拍系统，实现了从商品上架、直播间开播、实时竞价到订单履约的完整业务闭环。

系统采用 **前后端分离架构**，后端基于 Fastify + Socket.IO 提供高性能 REST API 和 WebSocket 实时通信服务，前端使用 React 18 + Vite 5 构建移动端优先的 SPA 应用。数据层采用 **MySQL 8** 负责持久化存储，**Redis 7** 承载排行榜、分布式锁、限流和缓存等高频热路径操作，实现亚毫秒级响应。

### 项目亮点

- 🚀 **毫秒级实时竞价** — WebSocket 全双工通信，倒计时精准同步，自动延时防截拍
- 🔒 **高并发安全** — Redis Lua 原子操作 + CAS 乐观锁 + 幂等键，支持 500+ 并发出价
- 📱 **移动端优先** — 抖音风格暗色主题，沉浸式直播间体验
- 🧪 **完整测试体系** — 单元测试 + 集成测试 + E2E 测试 + 负载测试，CI/CD 自动化
- 🏗️ **领域驱动设计** — 纯函数领域模型、服务编排、仓库模式，层次清晰可测试

***

## 功能特性

### 核心拍卖引擎

- **实时竞价** — 基于 WebSocket 的即时出价传播，所有客户端毫秒级倒计时同步
- **自动延时** — 临近截止时间出价时可配置的倒计时延长，防止最后一秒截拍
- **封顶价格** — 出价达到预设封顶价时自动结束拍卖
- **CAS 出价校验** — 基于 Redis Lua 脚本的 Compare-And-Swap 原子操作，无锁高并发
- **幂等出价** — 客户端生成幂等键，结合 Redis + MySQL 唯一约束防止重复出价
- **频率限制** — 滑动窗口算法限制每位用户每秒最多 5 次出价

### 直播间体验

- **实时排行榜** — 基于 Redis Sorted Set 的实时更新竞价排名
- **情绪反馈** — "领先"和"被超越"事件的动画通知
- **聊天覆盖层** — 通过 WebSocket 广播实现的房间内聊天
- **模拟直播流** — 内置视频流模拟，方便演示
- **房间隔离** — Socket.IO 房间机制配合每用户状态管理

### 交易流程

- **商品管理** — 完整的商品 CRUD，支持可配置的拍卖规则（起拍价、加价幅度、封顶价、时长、延时次数）
- **订单生命周期** — 待付款 → 已付款 → 已完成，BullMQ 队列驱动的超时自动取消
- **模拟支付** — 内置支付模拟，可测试完整的购买流程
- **用户角色** — 商家（主播/卖家）和用户（竞拍者/观众），基于 JWT 的角色授权

### 用户体验

- **移动端优先** — 抖音风格暗色主题，针对移动端 H5 优化
- **购物车** — 浮动购物车按钮，底部弹出商品列表，状态感知的价格标签
- **出价面板** — 半屏出价弹窗，带 +/- 步进器和实时价格更新
- **出价提示** — 根据上下文显示最低出价金额或领先状态
- **个人中心** — 资料编辑、订单历史和订单详情页
- **流畅动画** — Framer Motion 驱动的出价按钮、倒计时脉冲和情绪提示动画

***

## 技术栈

| 层级         | 技术                                        |
| ---------- | ----------------------------------------- |
| **前端框架**   | React 18 + TypeScript 5.6                 |
| **前端构建**   | Vite 5                                    |
| **状态管理**   | Zustand 5                                 |
| **UI 组件库** | Ant Design 6 + Radix UI + TailwindCSS 3.4 |
| **动画引擎**   | Framer Motion 11                          |
| **后端框架**   | Fastify 4                                 |
| **实时通信**   | Socket.IO 4                               |
| **数据库访问**  | Knex.js 3                                 |
| **认证鉴权**   | JWT (jsonwebtoken) + bcrypt               |
| **任务队列**   | BullMQ 5                                  |
| **日志系统**   | Pino 9                                    |
| **关系数据库**  | MySQL 8                                   |
| **缓存/消息**  | Redis 7 (ioredis)                         |
| **单元测试**   | Vitest 2.1 + Testing Library              |
| **E2E 测试** | Playwright                                |
| **负载测试**   | Artillery                                 |
| **CI/CD**  | GitHub Actions                            |

***

## 项目结构

```
Live-Auction/
├── frontend/                           # 前端 React SPA
│   ├── src/
│   │   ├── components/                 # UI 组件
│   │   │   ├── auction/               #   竞拍相关：BidButton, BidSheet, CartPanel, Leaderboard, Countdown 等
│   │   │   ├── product/               #   商品卡片
│   │   │   └── admin/                 #   管理后台：ConfirmDialog
│   │   ├── design-system/             # shadcn/ui 风格基础组件 + 设计令牌
│   │   ├── hooks/                     # 自定义 Hooks：useWebSocket, useBid, useCountdown, useCart, useAudio 等
│   │   ├── pages/                     # 路由页面
│   │   │   ├── admin/                 #   管理后台：商品管理、拍卖管理、订单管理
│   │   │   ├── auth/                  #   登录 / 注册
│   │   │   ├── live/                  #   直播间：房间列表、竞拍面板、竞拍结果、历史记录
│   │   │   └── profile/              #   个人中心：资料编辑、我的订单
│   │   ├── services/                  # API 客户端 + Socket.IO 单例
│   │   ├── store/                     # Zustand 状态管理（authStore, auctionStore）
│   │   ├── lib/                       # 工具函数（format, idempotency, jwt, statusConfig）
│   │   ├── types/                     # TypeScript 类型定义（api, ws）
│   │   └── tests/                     # 测试 fixtures 和 mocks
│   ├── tailwind.config.ts             # TailwindCSS 主题配置（抖音风格色板）
│   └── vite.config.ts                 # Vite 配置（代理、别名、测试）
│
├── backend/                            # 后端 Fastify + Socket.IO 服务
│   ├── src/
│   │   ├── domain/                     # 纯业务逻辑（零副作用）
│   │   │   ├── auction.ts             #   拍卖状态机
│   │   │   └── bid.ts                 #   出价校验
│   │   ├── services/                   # 业务服务编排
│   │   │   ├── auction.service.ts     #   拍卖工作流
│   │   │   ├── bid.service.ts         #   出价处理（CAS 模式）
│   │   │   ├── order.service.ts       #   订单生命周期
│   │   │   ├── product.service.ts     #   商品 CRUD
│   │   │   ├── auth.service.ts        #   认证（登录/注册/刷新令牌）
│   │   │   └── auction-timer-manager.ts # 拍卖倒计时管理
│   │   ├── repositories/               # 数据访问层（7 个仓库）
│   │   ├── routes/                     # REST API 路由处理
│   │   ├── ws/                         # WebSocket 处理器
│   │   │   ├── handlers/              #   bid, auction 事件处理
│   │   │   ├── rooms.ts               #   房间管理
│   │   │   └── bid-event-bus.ts       #   出价事件总线
│   │   ├── middleware/                 # 中间件（JWT 认证、错误处理、限流）
│   │   ├── infrastructure/             # 基础设施
│   │   │   ├── cache/                 #   Redis 客户端、Lua 脚本、熔断器
│   │   │   ├── db/                    #   Knex 配置、迁移文件、种子数据
│   │   │   └── queue/                 #   BullMQ 订单超时队列
│   │   ├── config/                     # 环境变量加载与校验
│   │   └── lib/                        # 共享工具（错误类、缓存、分页、响应封装）
│   ├── tests/
│   │   ├── unit/                       # 单元测试（domain, services, middleware, ws）
│   │   └── integration/                # 集成测试（API 端点, WebSocket 场景）
│   └── docker-compose.test.yml         # 测试环境 Docker 配置
│
├── e2e/                                # E2E 端到端测试（Playwright）
│   ├── smoke/                          # 冒烟测试
│   └── *.spec.ts                       # 认证、竞价流程、商家流程、网络恢复、实时同步
│
└── specs/                              # 功能规格说明文档
```

### 数据流架构

```
客户端 (React SPA)
  │
  ├── REST API ──────────► Fastify 路由 ──► 服务层 ──► 仓库层 ──► MySQL（持久化）
  │                                                │
  └── WebSocket ─────────► Socket.IO ──► 处理器 ───┤
                                                   └──► Redis（排行榜、CAS锁、缓存、限流）
                                                         │
                                                         └──► BullMQ（异步任务队列）
```

***

## 依赖环境

| 依赖             | 最低版本   | 说明                 |
| -------------- | ------ | ------------------ |
| **Node.js**    | >= 18  | 运行时环境              |
| **pnpm**       | >= 8   | 包管理器（推荐）           |
| **MySQL**      | >= 8.0 | 关系型数据库             |
| **Redis**      | >= 7.0 | 缓存与消息中间件           |
| **Docker**（可选） | >= 20  | 用于快速启动 MySQL/Redis |

> ⚠️ **Windows 用户注意**：`bcrypt` 依赖需要 Node.js 原生编译环境，若安装失败请先安装 [windows-build-tools](https://github.com/felixrieseberg/windows-build-tools)。

***

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/ylcmy/Live-Auction.git
cd Live-Auction
```

### 2. 启动 MySQL 和 Redis

```bash
# 方式一：Docker 快速启动（推荐）
docker run -d --name auction-mysql \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=live_auction \
  -p 3306:3306 mysql:8

docker run -d --name auction-redis \
  -p 6379:6379 redis:7-alpine

# 方式二：使用本地已安装的 MySQL 和 Redis
# 确保 MySQL 在 3306 端口运行，Redis 在 6379 端口运行
```

### 3. 配置并启动后端

```bash
cd backend
cp .env.example .env    # 复制环境变量模板，按需编辑
pnpm install            # 安装依赖
pnpm migrate:latest     # 执行数据库迁移
pnpm seed:run           # 加载示例数据
pnpm dev                # 启动开发服务器（端口 3001）
```

### 4. 启动前端

```bash
# 新终端
cd frontend
pnpm install            # 安装依赖
pnpm dev                # 启动 Vite 开发服务器（端口 5173）
```

### 5. 访问应用

打开浏览器访问 `http://localhost:5173`

### 测试账号

| 用户名         | 密码         | 角色 | 昵称     |
| ----------- | ---------- | -- | ------ |
| `merchant1` | `pass1234` | 商家 | 李老板    |
| `user1`     | `pass1234` | 用户 | 竞拍达人小王 |
| `user2`     | `pass1234` | 用户 | 捡漏专家小李 |

***

## 配置说明

后端通过环境变量进行配置，模板文件位于 [backend/.env.example](backend/.env.example)。

### 环境变量一览

| 变量名              | 默认值                      | 说明                                                         |
| ---------------- | ------------------------ | ---------------------------------------------------------- |
| `PORT`           | `3001`                   | 后端服务监听端口                                                   |
| `NODE_ENV`       | `development`            | 运行环境：`development` / `production` / `test`                 |
| `LOG_LEVEL`      | `info`                   | 日志级别：`debug` / `info` / `warn` / `error`                   |
| **数据库**          | <br />                   | <br />                                                     |
| `DB_HOST`        | `localhost`              | MySQL 主机地址                                                 |
| `DB_PORT`        | `3306`                   | MySQL 端口                                                   |
| `DB_USER`        | `root`                   | MySQL 用户名                                                  |
| `DB_PASSWORD`    | —                        | MySQL 密码                                                   |
| `DB_NAME`        | `live_auction`           | 数据库名称                                                      |
| **Redis**        | <br />                   | <br />                                                     |
| `REDIS_URL`      | `redis://localhost:6379` | Redis 连接 URL（含密码格式：`redis://:password@host:port/db`）       |
| **认证**           | <br />                   | <br />                                                     |
| `JWT_SECRET`     | —                        | JWT 签名密钥（**生产环境必须 >= 32 字符**，使用 `openssl rand -hex 32` 生成） |
| `JWT_EXPIRES_IN` | `3600`                   | 访问令牌过期时间（秒）                                                |
| `BCRYPT_COST`    | `12`                     | bcrypt 哈希轮数                                                |
| **安全**           | <br />                   | <br />                                                     |
| `CORS_ORIGINS`   | —                        | CORS 允许的源列表，逗号分隔（生产环境必填，禁止使用 `*`）                          |

### 配置示例

```bash
# 开发环境最小配置
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=live_auction
REDIS_URL=redis://localhost:6379
JWT_SECRET=$(openssl rand -hex 32)
```

> 💡 **提示**：`NODE_ENV=production` 时，系统会强制校验 `JWT_SECRET` 长度和 `CORS_ORIGINS` 非空，未通过校验将阻止启动。

***

## 可用脚本

### 后端 (`backend/`)

| 脚本                      | 说明                                     |
| ----------------------- | -------------------------------------- |
| `pnpm dev`              | 启动开发服务器（热重载，tsx watch）                 |
| `pnpm build`            | 编译 TypeScript → `dist/`                |
| `pnpm start`            | 运行生产构建                                 |
| `pnpm test`             | 运行全部单元测试 + 集成测试                        |
| `pnpm test:critical`    | 运行核心路径测试（domain/services/ws，覆盖率阈值 90%） |
| `pnpm test:integration` | 仅运行集成测试                                |
| `pnpm migrate:latest`   | 执行待处理的数据库迁移                            |
| `pnpm migrate:rollback` | 回滚上一次迁移                                |
| `pnpm seed:run`         | 加载种子数据（测试账号 + 示例商品）                    |
| `pnpm load:smoke`       | Artillery 冒烟负载测试                       |

### 前端 (`frontend/`)

| 脚本               | 说明                     |
| ---------------- | ---------------------- |
| `pnpm dev`       | 启动 Vite 开发服务器（端口 5173） |
| `pnpm dev:test`  | 启动测试模式开发服务器（端口 5174）   |
| `pnpm build`     | 类型检查 + 生产构建            |
| `pnpm preview`   | 预览生产构建产物               |
| `pnpm test`      | 运行组件和 Hooks 测试         |
| `pnpm typecheck` | 运行 TypeScript 类型检查     |

### E2E 测试（项目根目录）

| 脚本                                    | 说明          |
| ------------------------------------- | ----------- |
| `npx playwright test`                 | 运行完整 E2E 测试 |
| `npx playwright test --project=smoke` | 仅运行冒烟测试     |

***

## 数据库设计

系统使用 **Knex.js** 进行数据库迁移管理，共 19 个迁移文件。核心表结构如下：

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│    users      │     │   products    │     │  auction_rules    │
│──────────────│     │──────────────│     │──────────────────│
│ id           │◄──┐ │ id           │◄──┐ │ id               │
│ username     │   │ │ merchant_id  │───┘ │ product_id       │──┘
│ password_hash│   │ │ name         │     │ start_price      │
│ role         │   │ │ status       │     │ bid_increment    │
│ nickname     │   │ │ ...          │     │ ceiling_price    │
│ avatar_url   │   │ └──────────────┘     │ duration_seconds │
└──────────────┘   │                      │ extend_seconds   │
                   │ ┌──────────────┐     │ max_extensions   │
                   │ │ live_rooms    │     └──────────────────┘
                   │ │──────────────│
                   │ │ id           │     ┌──────────────────┐
                   │ │ host_id      │──┘  │ auction_sessions  │
                   │ │ title        │     │──────────────────│
                   │ │ status       │     │ id               │
                   │ └──────────────┘     │ product_id       │
                   │                      │ rule_id          │
                   │                      │ room_id          │
                   │                      │ status           │
                   │                      │ current_price    │
                   │                      │ winner_id        │──┐
                   │                      │ version (CAS)    │  │
                   │                      └──────────────────┘  │
                   │                                            │
                   │ ┌──────────────┐     ┌──────────────────┐  │
                   │ │ bid_records   │     │     orders        │  │
                   │ │──────────────│     │──────────────────│  │
                   └─│ session_id   │     │ session_id       │  │
                     │ user_id      │     │ buyer_id         │◄─┘
                     │ bid_amount   │     │ final_price      │
                     │ idempotency_ │     │ status           │
                     │   key        │     │ expire_at        │
                     └──────────────┘     └──────────────────┘
```

### 表说明

| 表名                 | 说明                                                                      |
| ------------------ | ----------------------------------------------------------------------- |
| `users`            | 用户表，区分商家（merchant）和普通用户（user）角色                                         |
| `products`         | 商品表，关联商家，管理商品状态                                                         |
| `auction_rules`    | 拍卖规则表，与商品一对一关联                                                          |
| `live_rooms`       | 直播间表，管理房间上线/下线状态                                                        |
| `auction_sessions` | 拍卖会话表，包含乐观锁 `version` 字段，状态流转：pending → active → ended/cancelled/unsold |
| `bid_records`      | 出价记录表，`idempotency_key` 唯一约束保证幂等性                                       |
| `orders`           | 订单表，状态流转：pending\_payment → paid → completed / cancelled                |

***

## API 参考

### 认证

| 方法     | 端点                   | 说明             |
| ------ | -------------------- | -------------- |
| `POST` | `/api/auth/register` | 注册新账号          |
| `POST` | `/api/auth/login`    | 登录（返回 JWT 令牌对） |
| `POST` | `/api/auth/refresh`  | 刷新访问令牌         |

### 商品管理（商家）

| 方法     | 端点                         | 说明        |
| ------ | -------------------------- | --------- |
| `POST` | `/api/products`            | 创建商品及拍卖规则 |
| `GET`  | `/api/products`            | 获取商家商品列表  |
| `GET`  | `/api/products/:id`        | 获取商品详情    |
| `PUT`  | `/api/products/:id/rules`  | 更新拍卖规则    |
| `PUT`  | `/api/products/:id/status` | 更新商品状态    |

### 直播间

| 方法     | 端点                      | 说明             |
| ------ | ----------------------- | -------------- |
| `POST` | `/api/rooms`            | 创建直播间（商家）      |
| `GET`  | `/api/rooms`            | 获取可用直播间列表      |
| `GET`  | `/api/rooms/:id`        | 获取直播间及拍卖商品详情   |
| `PUT`  | `/api/rooms/:id/status` | 切换直播间上线/下线（商家） |

### 拍卖

| 方法     | 端点                         | 说明       |
| ------ | -------------------------- | -------- |
| `POST` | `/api/auctions`            | 开始拍卖（商家） |
| `GET`  | `/api/auctions`            | 获取拍卖会话列表 |
| `POST` | `/api/auctions/:id/cancel` | 取消拍卖（商家） |

### 订单

| 方法     | 端点                    | 说明     |
| ------ | --------------------- | ------ |
| `GET`  | `/api/orders`         | 获取订单列表 |
| `GET`  | `/api/orders/:id`     | 获取订单详情 |
| `POST` | `/api/orders/:id/pay` | 模拟支付   |

### WebSocket 事件

| 事件                  | 方向        | 说明     |
| ------------------- | --------- | ------ |
| `bid:submit`        | 客户端 → 服务端 | 提交出价   |
| `bid:new`           | 服务端 → 广播  | 新出价通知  |
| `rank:update`       | 服务端 → 广播  | 排行榜更新  |
| `countdown:sync`    | 服务端 → 广播  | 倒计时同步  |
| `countdown:extend`  | 服务端 → 广播  | 截止时间延长 |
| `auction:started`   | 服务端 → 广播  | 拍卖开始   |
| `auction:ended`     | 服务端 → 广播  | 拍卖结束   |
| `emotion:lead`      | 服务端 → 客户端 | 你正在领先  |
| `emotion:overtaken` | 服务端 → 客户端 | 你已被超越  |

***

## 测试

### 运行测试

```bash
# 后端 — 全部测试
cd backend && pnpm test

# 后端 — 核心路径测试（高覆盖率阈值）
cd backend && pnpm test:critical

# 后端 — 集成测试（需要 MySQL + Redis 测试实例）
cd backend && pnpm test:integration

# 前端 — 组件和 Hooks 测试
cd frontend && pnpm test

# E2E — 端到端测试（需要前后端服务运行）
cd e2e && npx playwright test
```

### 测试环境 Docker（集成测试用）

```bash
# 启动测试专用的 MySQL 和 Redis（不同端口，避免冲突）
cd backend
docker compose -f docker-compose.test.yml up -d

# 执行集成测试
pnpm test:integration
```

### 测试结构

```
backend/tests/
├── unit/                               # 单元测试（纯函数、Mock 依赖）
│   ├── domain/                         #   auction.test.ts, bid.test.ts
│   ├── services/                       #   auction.service, bid.service, auth.service, order.service 等
│   ├── middleware/                      #   auth, error-handler, rate-limiter
│   ├── ws/                             #   auction-handler, bid-handler, bid-event-bus
│   └── lib/                            #   app-error, paginate, reply, case-transform, input-boundary
├── integration/                        # 集成测试（真实数据库连接）
│   ├── api/                            #   REST 端点：auth, auction, bid-idempotency, order, product, room
│   └── ws/                             #   WebSocket 场景：并发竞价、倒计时同步、重连、房间隔离、熔断等

frontend/src/**/__tests__/              # 前端测试（共 27 个测试文件）
├── components/auction/__tests__/       #   BidButton, BidSheet, CartPanel, Leaderboard, Countdown 等
├── hooks/__tests__/                    #   useBid, useCountdown, useWebSocket, useCart, useAudio
├── store/__tests__/                    #   authStore, auctionStore
├── services/__tests__/                 #   api, socket
└── lib/__tests__/                      #   cn, idempotency, jwt, format, statusConfig

e2e/                                    # E2E 测试（Playwright）
├── smoke/                              #   冒烟测试：核心竞价流程
├── auth.spec.ts                        #   认证流程
├── bidding-flow.spec.ts                #   竞价完整流程
├── merchant-flow.spec.ts               #   商家操作流程
├── network-recovery.spec.ts            #   网络断连恢复
└── realtime-sync.spec.ts               #   多端实时同步
```

***

## 核心设计决策

### Redis 优先的热路径

排行榜（Sorted Set）、CAS 出价锁（Lua 原子脚本）、限流（滑动窗口）和倒计时定时器全部驻留在 Redis 中，实现亚毫秒级延迟。MySQL 持久化通过 `setImmediate` 异步执行，保持竞价路径非阻塞。

### 领域驱动分层

`domain/` 中的纯函数处理出价校验和拍卖状态转换，零副作用，易于测试。服务层编排业务工作流，协调领域逻辑与基础设施。路由层仅负责 HTTP/WS 传输。

### CAS 乐观出价

使用 Redis Lua 脚本实现 Compare-And-Swap 原子操作，替代传统全局锁。结合 `auction_sessions.version` 字段的数据库乐观锁，实现高并发下无锁竞价，避免竞态条件。

### 异步事件广播

出价成功后立即返回响应，排行榜更新和事件广播通过事件总线异步推送，减少竞价路径延迟。

### WebSocket 房间隔离

每个直播间对应一个 Socket.IO 房间，状态相互隔离。重连时按用户单独广播拍卖状态，确保迟到加入的用户也能看到准确数据。

### 熔断降级

Redis 不可用时自动降级到数据库查询，Redis 恢复后自动重建缓存，保证系统可用性。

***

## CI/CD

项目使用 **GitHub Actions** 实现自动化 CI/CD 流水线，包含 4 个并行任务：

```
┌─────────────────┐  ┌─────────────────┐
│  Frontend Tests  │  │  Backend Tests   │
│  (Vitest+Coverage)│  │  (MySQL+Redis    │
│                  │  │   +Unit+Integ)   │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐  ┌─────────────────┐
         │   E2E Tests          │  │  Load Smoke (k6) │
         │   (Playwright)       │  │                  │
         └─────────────────────┘  └─────────────────┘
```

| 任务             | 触发条件                      | 内容                                        |
| -------------- | ------------------------- | ----------------------------------------- |
| Frontend Tests | Push / PR → main, develop | Vitest 单元测试 + 覆盖率报告                       |
| Backend Tests  | Push / PR → main, develop | MySQL 8 + Redis 7 服务容器 → 迁移 → 单元测试 + 集成测试 |
| E2E Tests      | 前后端测试通过后                  | Playwright 冒烟测试（Chromium）                 |
| Load Smoke     | 后端测试通过后                   | k6 负载冒烟测试                                 |

***

## 开源许可

本项目仅供学习和演示用途。

***

<div align="center">

**使用 TypeScript、React 和 Fastify 精心构建**

如果这个项目对你有帮助，请给一个 ⭐ Star 支持一下！

</div>
