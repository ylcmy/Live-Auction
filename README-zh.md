<div align="center">

# Live Auction

**基于现代 Web 技术栈构建的实时直播竞拍平台**

灵感来源于抖音电商直播，提供毫秒级同步的竞价体验。

[English](./README.md) | 中文

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-4.28-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

</div>

---

## 功能特性

### 核心拍卖引擎

- **实时竞价** -- 基于 WebSocket 的即时出价传播，所有客户端毫秒级倒计时同步
- **自动延时** -- 临近截止时间出价时可配置的倒计时延长，防止最后一秒截拍
- **封顶价格** -- 出价达到预设封顶价时自动结束拍卖
- **分布式锁** -- 基于 Redis SETNX 的锁机制，确保高并发下的出价一致性
- **幂等出价** -- 客户端生成幂等键，结合 Redis + MySQL 唯一约束防止重复出价
- **频率限制** -- 滑动窗口算法限制每位用户每秒最多 5 次出价

### 直播间体验

- **实时排行榜** -- 基于 Redis Sorted Set 的实时更新竞价排名
- **情绪反馈** -- "领先"和"被超越"事件的动画通知
- **聊天覆盖层** -- 通过 WebSocket 广播实现的房间内聊天
- **模拟直播流** -- 内置视频流模拟，方便演示
- **房间隔离** -- Socket.IO 房间机制配合每用户状态管理

### 交易流程

- **商品管理** -- 完整的商品 CRUD，支持可配置的拍卖规则（起拍价、加价幅度、封顶价、时长、延时次数）
- **订单生命周期** -- 待付款 -> 已付款 -> 已完成，超时订单自动取消
- **模拟支付** -- 内置支付模拟，可测试完整的购买流程
- **用户角色** -- 商家（主播/卖家）和用户（竞拍者/观众），基于 JWT 的角色授权

### 用户体验

- **移动端优先** -- 抖音风格暗色主题，针对移动端 H5 优化
- **购物车** -- 浮动购物车按钮，底部弹出商品列表，状态感知的价格标签
- **出价面板** -- 半屏出价弹窗，带 +/- 步进器和实时价格更新
- **出价提示** -- 根据上下文显示最低出价金额或领先状态
- **个人中心** -- 资料编辑、订单历史和订单详情页
- **流畅动画** -- Framer Motion 驱动的出价按钮、倒计时脉冲和情绪提示动画

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18, Vite 5, TypeScript, Zustand, TailwindCSS, Ant Design, Radix UI, Framer Motion |
| **后端** | Fastify 4, Socket.IO 4, Knex.js, JWT 认证, Pino 日志 |
| **数据库** | MySQL 8（持久化存储）, Redis 7（排行榜、分布式锁、缓存、限流） |
| **测试** | Vitest, Testing Library, k6（压测） |
| **工具链** | pnpm workspaces, ESLint, Prettier, TypeScript 严格模式 |

---

## 项目架构

```
├── frontend/                   # React SPA (Vite)
│   └── src/
│       ├── components/         # UI 组件
│       │   ├── auction/        # BidButton, BidSheet, CartPanel, Leaderboard, Countdown...
│       │   └── admin/          # ConfirmDialog
│       ├── design-system/      # shadcn/ui 风格基础组件 + 设计令牌
│       ├── hooks/              # useWebSocket, useBid, useCountdown, useCart, useAudio
│       ├── pages/              # 路由页面（管理后台、直播间、个人中心、认证）
│       ├── services/           # API 客户端 + Socket.IO 单例
│       ├── store/              # Zustand 状态管理（auth, auction）
│       └── lib/                # 工具函数（format, idempotency, jwt, statusConfig）
│
├── backend/                    # Fastify + Socket.IO 服务端
│   └── src/
│       ├── domain/             # 纯业务逻辑（状态机、出价校验）
│       ├── services/           # 业务服务（auction, bid, order, product, auth）
│       ├── repositories/       # 数据访问层（7 个仓库）
│       ├── routes/             # REST API 端点
│       ├── ws/                 # WebSocket 处理器（bid, auction, rooms）
│       ├── middleware/         # 认证、错误处理、限流
│       ├── infrastructure/     # 数据库迁移、种子数据、Redis 缓存
│       └── lib/                # 共享工具
│
└── specs/                      # 功能规格说明（SpecKit 工作流）
```

### 数据流

```
客户端 (React)
  │
  ├── REST API ────────────► Fastify 路由 ──► 服务层 ──► 仓库层 ──► MySQL
  │                                                    │
  └── WebSocket ───────────► Socket.IO ──► 处理器 ─────┤
                                                     └──► Redis（排行榜、分布式锁、缓存）
```

---

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- MySQL 8+
- Redis 7+

### 快速启动

**1. 启动 MySQL 和 Redis**

```bash
# MySQL
docker run -d --name auction-mysql \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=live_auction \
  -p 3306:3306 mysql:8

# Redis
docker run -d --name auction-redis \
  -p 6379:6379 redis:7-alpine
```

**2. 配置后端**

```bash
cd backend
cp .env.example .env    # 编辑数据库和 Redis 连接信息
pnpm install
pnpm migrate:latest     # 执行数据库迁移
pnpm seed:run           # 加载示例数据
```

**3. 启动开发服务器**

```bash
# 终端 1 -- 后端（端口 3001）
cd backend && pnpm dev

# 终端 2 -- 前端（端口 5173）
cd frontend && pnpm dev
```

**4. 打开应用**

访问 `http://localhost:5173`

### 测试账号

| 用户名 | 密码 | 角色 | 昵称 |
|--------|------|------|------|
| `merchant1` | `pass1234` | 商家 | 李老板 |
| `user1` | `pass1234` | 用户 | 竞拍达人小王 |
| `user2` | `pass1234` | 用户 | 捡漏专家小李 |

---

## 可用脚本

### 后端

| 脚本 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器（热重载） |
| `pnpm build` | 编译 TypeScript |
| `pnpm start` | 运行编译后的生产构建 |
| `pnpm test` | 运行单元测试 + 集成测试 |
| `pnpm migrate:latest` | 执行待处理的迁移 |
| `pnpm migrate:rollback` | 回滚上一次迁移 |
| `pnpm seed:run` | 加载种子数据到数据库 |

### 前端

| 脚本 | 说明 |
|------|------|
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm preview` | 预览生产构建 |
| `pnpm test` | 运行组件测试 |
| `pnpm typecheck` | 运行 TypeScript 类型检查 |

---

## 数据库结构

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
                   │                      │ version          │  │
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

---

## API 参考

### 认证

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 注册新账号 |
| `POST` | `/api/auth/login` | 登录（返回 JWT 令牌对） |
| `POST` | `/api/auth/refresh` | 刷新访问令牌 |

### 商品管理（商家）

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/products` | 创建商品及拍卖规则 |
| `GET` | `/api/products` | 获取商家商品列表 |
| `GET` | `/api/products/:id` | 获取商品详情 |
| `PUT` | `/api/products/:id/rules` | 更新拍卖规则 |
| `PUT` | `/api/products/:id/status` | 更新商品状态 |

### 直播间

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/rooms` | 创建直播间（商家） |
| `GET` | `/api/rooms` | 获取可用直播间列表 |
| `GET` | `/api/rooms/:id` | 获取直播间及拍卖商品详情 |
| `PUT` | `/api/rooms/:id/status` | 切换直播间上线/下线（商家） |

### 拍卖

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/auctions` | 开始拍卖（商家） |
| `GET` | `/api/auctions` | 获取拍卖会话列表 |
| `POST` | `/api/auctions/:id/cancel` | 取消拍卖（商家） |

### 订单

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/orders` | 获取订单列表 |
| `GET` | `/api/orders/:id` | 获取订单详情 |
| `POST` | `/api/orders/:id/pay` | 模拟支付 |

### WebSocket 事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `bid:submit` | 客户端 -> 服务端 | 提交出价 |
| `bid:new` | 服务端 -> 广播 | 新出价通知 |
| `rank:update` | 服务端 -> 广播 | 排行榜更新 |
| `countdown:sync` | 服务端 -> 广播 | 倒计时同步 |
| `countdown:extend` | 服务端 -> 广播 | 截止时间延长 |
| `auction:started` | 服务端 -> 广播 | 拍卖开始 |
| `auction:ended` | 服务端 -> 广播 | 拍卖结束 |
| `emotion:lead` | 服务端 -> 客户端 | 你正在领先 |
| `emotion:overtaken` | 服务端 -> 客户端 | 你已被超越 |

---

## 核心设计决策

**Redis 优先的热路径** -- 排行榜（Sorted Set）、分布式锁（SETNX）、限流（滑动窗口）和倒计时定时器全部驻留在 Redis 中，实现亚毫秒级延迟。MySQL 持久化通过 `setImmediate` 异步执行，保持竞价路径非阻塞。

**领域驱动分层** -- `domain/` 中的纯函数处理出价校验和拍卖状态转换，零副作用。服务层编排业务工作流。路由层仅负责 HTTP/WS 传输。

**乐观锁** -- `auction_sessions` 表的 `version` 字段防止并发结算时的丢失更新问题。

**WebSocket 房间隔离** -- 每个直播间对应一个 Socket.IO 房间，状态相互隔离。重连时按用户单独广播拍卖状态，确保迟到加入的用户也能看到准确数据。

---

## 测试

```bash
# 后端单元测试 + 集成测试
cd backend && pnpm test

# 前端组件测试
cd frontend && pnpm test

# 压力测试 (k6)
cd backend && k6 run tests/load/bid-consistency.k6.ts
cd backend && k6 run tests/load/ws-concurrency.k6.ts
```

测试结构遵循 AAA（Arrange-Act-Assert）模式：

```
backend/tests/
├── unit/
│   ├── domain/          # auction.test.ts, bid.test.ts
│   └── services/        # auction-settle.test.ts
├── integration/
│   ├── api/             # bid-idempotency.test.ts
│   └── ws/              # countdown-sync, reconnect, room-isolation
└── load/                # k6 压力测试（500 虚拟用户）
```

---

## 开源许可

本项目仅供学习和演示用途。

---

<div align="center">

**使用 TypeScript、React 和 Fastify 精心构建**

</div>
