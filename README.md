<div align="center">

# Live Auction

**A real-time live-streaming auction platform built with modern web technologies**

Inspired by Douyin e-commerce live broadcasting, delivering millisecond-level synchronized bidding experiences.

English | [中文](./README-zh.md)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-4.28-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

</div>

---

## Features

### Core Auction Engine

- **Real-time Bidding** -- WebSocket-powered instant bid propagation with millisecond countdown sync across all connected clients
- **Auto-Extend** -- Configurable countdown extension when bids arrive near the deadline, preventing sniping
- **Ceiling Price** -- Automatic auction termination when the preset price ceiling is reached
- **Distributed Locking** -- Redis SETNX-based locks ensure bid consistency under high concurrency
- **Idempotent Bids** -- Client-generated idempotency keys with Redis + MySQL unique constraints prevent duplicate bids
- **Rate Limiting** -- Sliding window algorithm limits bids to 5/second per user per session

### Live Room Experience

- **Real-time Leaderboard** -- Live-updating ranked bidder list powered by Redis Sorted Sets
- **Emotion Feedback** -- Animated notifications for "leading" and "overtaken" events
- **Chat Overlay** -- In-room chat messaging via WebSocket broadcast
- **Simulated Stream** -- Built-in video stream simulation for demo purposes
- **Room Isolation** -- Socket.IO rooms with per-user state management

### Commerce Flow

- **Product Management** -- Full CRUD for auction items with configurable rules (start price, increment, ceiling, duration, extensions)
- **Order Lifecycle** -- Pending payment -> Paid -> Completed flow with auto-cancel for expired orders
- **Mock Payment** -- Built-in payment simulation for testing the complete purchase flow
- **User Roles** -- Merchant (streamer/seller) and User (bidder/viewer) with JWT-based role authorization

### User Experience

- **Mobile-First UI** -- TikTok-inspired dark theme optimized for mobile H5
- **Shopping Cart** -- Floating cart with bottom-sheet product list and status-aware pricing
- **Bid Sheet** -- Half-screen bidding popup with +/- stepper and real-time price updates
- **Bid Hints** -- Contextual hints showing minimum bid or leading status
- **User Center** -- Profile editing, order history, and order detail pages
- **Framer Motion** -- Smooth animations for bid buttons, countdown pulses, and emotion toasts

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite 5, TypeScript, Zustand, TailwindCSS, Ant Design, Radix UI, Framer Motion |
| **Backend** | Fastify 4, Socket.IO 4, Knex.js, JWT Auth, Pino Logger |
| **Database** | MySQL 8 (persistent storage), Redis 7 (leaderboard, locks, cache, rate limiting) |
| **Testing** | Vitest, Testing Library, k6 (load testing) |
| **Tooling** | pnpm workspaces, ESLint, Prettier, TypeScript strict mode |

---

## Architecture

```
├── frontend/                   # React SPA (Vite)
│   └── src/
│       ├── components/         # UI components
│       │   ├── auction/        # BidButton, BidSheet, CartPanel, Leaderboard, Countdown...
│       │   └── admin/          # ConfirmDialog
│       ├── design-system/      # shadcn/ui-style primitives + design tokens
│       ├── hooks/              # useWebSocket, useBid, useCountdown, useCart, useAudio
│       ├── pages/              # Route pages (admin, live, profile, auth)
│       ├── services/           # API client + Socket.IO singleton
│       ├── store/              # Zustand stores (auth, auction)
│       └── lib/                # Utilities (format, idempotency, jwt, statusConfig)
│
├── backend/                    # Fastify + Socket.IO server
│   └── src/
│       ├── domain/             # Pure business logic (state machine, bid validation)
│       ├── services/           # Business services (auction, bid, order, product, auth)
│       ├── repositories/       # Data access layer (7 repos)
│       ├── routes/             # REST API endpoints
│       ├── ws/                 # WebSocket handlers (bid, auction, rooms)
│       ├── middleware/         # Auth, error handling, rate limiting
│       ├── infrastructure/     # DB migrations, seeds, Redis cache
│       └── lib/                # Shared utilities
│
└── specs/                      # Feature specifications (SpecKit workflow)
```

### Data Flow

```
Client (React)
  │
  ├── REST API ────────────► Fastify Routes ──► Services ──► Repositories ──► MySQL
  │                                                    │
  └── WebSocket ───────────► Socket.IO ──► Handlers ───┤
                                                     └──► Redis (leaderboard, locks, cache)
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- MySQL 8+
- Redis 7+

### Quick Start

**1. Start MySQL and Redis**

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

**2. Configure Backend**

```bash
cd backend
cp .env.example .env    # Edit with your DB/Redis credentials
pnpm install
pnpm migrate:latest     # Run database migrations
pnpm seed:run           # Load sample data
```

**3. Start Development Servers**

```bash
# Terminal 1 -- Backend (port 3001)
cd backend && pnpm dev

# Terminal 2 -- Frontend (port 5173)
cd frontend && pnpm dev
```

**4. Open the App**

Visit `http://localhost:5173`

### Test Accounts

| Username | Password | Role | Nickname |
|----------|----------|------|----------|
| `merchant1` | `pass1234` | Merchant | Li Boss |
| `user1` | `pass1234` | User | Bidder Wang |
| `user2` | `pass1234` | User | Expert Li |

---

## Available Scripts

### Backend

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start dev server with hot reload |
| `pnpm build` | Compile TypeScript |
| `pnpm start` | Run compiled production build |
| `pnpm test` | Run unit + integration tests |
| `pnpm migrate:latest` | Run pending migrations |
| `pnpm migrate:rollback` | Rollback last migration |
| `pnpm seed:run` | Seed database with sample data |

### Frontend

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Type-check + production build |
| `pnpm preview` | Preview production build |
| `pnpm test` | Run component tests |
| `pnpm typecheck` | Run TypeScript type checking |

---

## Database Schema

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

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new account |
| `POST` | `/api/auth/login` | Login (returns JWT pair) |
| `POST` | `/api/auth/refresh` | Refresh access token |

### Products (Merchant)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/products` | Create product with auction rules |
| `GET` | `/api/products` | List merchant's products |
| `GET` | `/api/products/:id` | Get product detail |
| `PUT` | `/api/products/:id/rules` | Update auction rules |
| `PUT` | `/api/products/:id/status` | Update product status |

### Live Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/rooms` | Create room (Merchant) |
| `GET` | `/api/rooms` | List available rooms |
| `GET` | `/api/rooms/:id` | Get room with auction items |
| `PUT` | `/api/rooms/:id/status` | Toggle room online/offline (Merchant) |

### Auctions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auctions` | Start auction (Merchant) |
| `GET` | `/api/auctions` | List auction sessions |
| `POST` | `/api/auctions/:id/cancel` | Cancel auction (Merchant) |

### Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/orders` | List orders |
| `GET` | `/api/orders/:id` | Get order detail |
| `POST` | `/api/orders/:id/pay` | Mock payment |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `bid:submit` | Client -> Server | Submit a bid |
| `bid:new` | Server -> Broadcast | New bid notification |
| `rank:update` | Server -> Broadcast | Leaderboard update |
| `countdown:sync` | Server -> Broadcast | Timer synchronization |
| `countdown:extend` | Server -> Broadcast | Deadline extended |
| `auction:started` | Server -> Broadcast | Auction started |
| `auction:ended` | Server -> Broadcast | Auction ended |
| `emotion:lead` | Server -> Client | You are leading |
| `emotion:overtaken` | Server -> Client | You've been outbid |

---

## Key Design Decisions

**Redis-First Hot Path** -- Leaderboard (Sorted Sets), distributed locks (SETNX), rate limiting (sliding window), and countdown timers all reside in Redis for sub-millisecond latency. MySQL persistence happens asynchronously via `setImmediate`, keeping the bidding path non-blocking.

**Domain-Driven Layering** -- Pure domain functions in `domain/` handle bid validation and auction state transitions with zero side effects. Services orchestrate business workflows. Routes handle HTTP/WS transport only.

**Optimistic Locking** -- The `version` field on `auction_sessions` prevents lost updates during concurrent settlement operations.

**WebSocket Room Isolation** -- Each live room is a Socket.IO room with isolated state. Per-user auction state is broadcast individually on reconnect, ensuring late joiners see accurate data.

---

## Testing

```bash
# Backend unit + integration tests
cd backend && pnpm test

# Frontend component tests
cd frontend && pnpm test

# Load testing (k6)
cd backend && k6 run tests/load/bid-consistency.k6.ts
cd backend && k6 run tests/load/ws-concurrency.k6.ts
```

Test structure follows the AAA (Arrange-Act-Assert) pattern:

```
backend/tests/
├── unit/
│   ├── domain/          # auction.test.ts, bid.test.ts
│   └── services/        # auction-settle.test.ts
├── integration/
│   ├── api/             # bid-idempotency.test.ts
│   └── ws/              # countdown-sync, reconnect, room-isolation
└── load/                # k6 load tests (500 VUs)
```

---

## License

This project is for educational and demonstration purposes.

---

<div align="center">

**Built with care using TypeScript, React, and Fastify**

</div>
