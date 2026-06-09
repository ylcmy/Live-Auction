<div align="center">

# Real-Time Auction Master

### Douyin E-Commerce Live Auction Full-Stack System

**A real-time live-streaming auction platform built with modern web technologies, inspired by Douyin e-commerce live broadcasting, delivering millisecond-level synchronized bidding experiences.**

English | [中文](./README-zh.md)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-4.28-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Vitest](https://img.shields.io/badge/Vitest-2.1-729B1B?logo=vitest&logoColor=white)](https://vitest.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Available Scripts](#available-scripts)
- [Database Design](#database-design)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Key Design Decisions](#key-design-decisions)
- [CI/CD](#cicd)
- [License](#license)

---

## Overview

Real-Time Auction Master is a full-stack auction system designed for Douyin e-commerce live-streaming scenarios. It implements the complete business loop from product listing, live room hosting, real-time bidding, to order fulfillment.

The system uses a **frontend-backend separated architecture**. The backend is built on Fastify + Socket.IO providing high-performance REST APIs and WebSocket real-time communication. The frontend is a mobile-first SPA built with React 18 + Vite 5. The data layer uses **MySQL 8** for persistent storage and **Redis 7** for high-frequency operations including leaderboards, distributed locks, rate limiting, and caching — achieving sub-millisecond response times.

### Highlights

- 🚀 **Millisecond-Level Real-Time Bidding** — Full-duplex WebSocket communication, precise countdown synchronization, auto-extend to prevent sniping
- 🔒 **High-Concurrency Safety** — Redis Lua atomic operations + CAS optimistic locking + idempotency keys, supporting 500+ concurrent bidders
- 📱 **Mobile-First UI** — Douyin-inspired dark theme with immersive live room experience
- 🧪 **Comprehensive Testing** — Unit + Integration + E2E + Load tests with automated CI/CD
- 🏗️ **Domain-Driven Design** — Pure domain functions, service orchestration, repository pattern — clear layering and testability

---

## Features

### Core Auction Engine

- **Real-time Bidding** — WebSocket-powered instant bid propagation with millisecond countdown sync across all connected clients
- **Auto-Extend** — Configurable countdown extension when bids arrive near the deadline, preventing sniping
- **Ceiling Price** — Automatic auction termination when the preset price ceiling is reached
- **CAS Bid Validation** — Redis Lua script-based Compare-And-Swap atomic operations for lock-free high concurrency
- **Idempotent Bids** — Client-generated idempotency keys with Redis + MySQL unique constraints prevent duplicate bids
- **Rate Limiting** — Sliding window algorithm limits bids to 5/second per user per session

### Live Room Experience

- **Real-time Leaderboard** — Live-updating ranked bidder list powered by Redis Sorted Sets
- **Emotion Feedback** — Animated notifications for "leading" and "overtaken" events
- **Chat Overlay** — In-room chat messaging via WebSocket broadcast
- **Simulated Stream** — Built-in video stream simulation for demo purposes
- **Room Isolation** — Socket.IO rooms with per-user state management

### Commerce Flow

- **Product Management** — Full CRUD for auction items with configurable rules (start price, increment, ceiling, duration, extensions)
- **Order Lifecycle** — Pending payment → Paid → Completed flow with BullMQ queue-driven auto-cancel for expired orders
- **Mock Payment** — Built-in payment simulation for testing the complete purchase flow
- **User Roles** — Merchant (streamer/seller) and User (bidder/viewer) with JWT-based role authorization

### User Experience

- **Mobile-First UI** — Douyin-inspired dark theme optimized for mobile H5
- **Shopping Cart** — Floating cart with bottom-sheet product list and status-aware pricing
- **Bid Sheet** — Half-screen bidding popup with +/- stepper and real-time price updates
- **Bid Hints** — Contextual hints showing minimum bid or leading status
- **User Center** — Profile editing, order history, and order detail pages
- **Framer Motion** — Smooth animations for bid buttons, countdown pulses, and emotion toasts

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend Framework** | React 18 + TypeScript 5.6 |
| **Frontend Build** | Vite 5 |
| **State Management** | Zustand 5 |
| **UI Libraries** | Ant Design 6 + Radix UI + TailwindCSS 3.4 |
| **Animation Engine** | Framer Motion 11 |
| **Backend Framework** | Fastify 4 |
| **Real-time Communication** | Socket.IO 4 |
| **Database Access** | Knex.js 3 |
| **Authentication** | JWT (jsonwebtoken) + bcrypt |
| **Job Queue** | BullMQ 5 |
| **Logging** | Pino 9 |
| **Relational Database** | MySQL 8 |
| **Cache / Messaging** | Redis 7 (ioredis) |
| **Unit Testing** | Vitest 2.1 + Testing Library |
| **E2E Testing** | Playwright |
| **Load Testing** | Artillery |
| **CI/CD** | GitHub Actions |

---

## Project Structure

```
Live-Auction/
├── frontend/                           # React SPA (Vite)
│   ├── src/
│   │   ├── components/                 # UI Components
│   │   │   ├── auction/               #   BidButton, BidSheet, CartPanel, Leaderboard, Countdown, etc.
│   │   │   ├── product/               #   Product card
│   │   │   └── admin/                 #   ConfirmDialog
│   │   ├── design-system/             # shadcn/ui-style primitives + design tokens
│   │   ├── hooks/                     # Custom hooks: useWebSocket, useBid, useCountdown, useCart, useAudio
│   │   ├── pages/                     # Route pages
│   │   │   ├── admin/                 #   Product/Auction/Order management
│   │   │   ├── auth/                  #   Login / Register
│   │   │   ├── live/                  #   Room list, Auction panel, Results, History
│   │   │   └── profile/              #   Profile editing, My orders
│   │   ├── services/                  # API client + Socket.IO singleton
│   │   ├── store/                     # Zustand stores (authStore, auctionStore)
│   │   ├── lib/                       # Utilities (format, idempotency, jwt, statusConfig)
│   │   ├── types/                     # TypeScript type definitions (api, ws)
│   │   └── tests/                     # Test fixtures and mocks
│   ├── tailwind.config.ts             # TailwindCSS theme (Douyin-style color palette)
│   └── vite.config.ts                 # Vite config (proxy, aliases, testing)
│
├── backend/                            # Fastify + Socket.IO Server
│   ├── src/
│   │   ├── domain/                     # Pure business logic (zero side effects)
│   │   │   ├── auction.ts             #   Auction state machine
│   │   │   └── bid.ts                 #   Bid validation
│   │   ├── services/                   # Business service orchestration
│   │   │   ├── auction.service.ts     #   Auction workflow
│   │   │   ├── bid.service.ts         #   Bid processing (CAS mode)
│   │   │   ├── order.service.ts       #   Order lifecycle
│   │   │   ├── product.service.ts     #   Product CRUD
│   │   │   ├── auth.service.ts        #   Authentication (login/register/refresh)
│   │   │   └── auction-timer-manager.ts # Auction countdown management
│   │   ├── repositories/               # Data access layer (7 repositories)
│   │   ├── routes/                     # REST API route handlers
│   │   ├── ws/                         # WebSocket handlers
│   │   │   ├── handlers/              #   bid, auction event handlers
│   │   │   ├── rooms.ts               #   Room management
│   │   │   └── bid-event-bus.ts       #   Bid event bus
│   │   ├── middleware/                 # JWT auth, error handling, rate limiting
│   │   ├── infrastructure/             # Infrastructure layer
│   │   │   ├── cache/                 #   Redis client, Lua scripts, circuit breaker
│   │   │   ├── db/                    #   Knex config, migrations, seeds
│   │   │   └── queue/                 #   BullMQ order timeout worker
│   │   ├── config/                     # Environment variable loading & validation
│   │   └── lib/                        # Shared utilities (error class, cache, pagination, reply)
│   ├── tests/
│   │   ├── unit/                       # Unit tests (domain, services, middleware, ws)
│   │   └── integration/                # Integration tests (API endpoints, WebSocket scenarios)
│   └── docker-compose.test.yml         # Test environment Docker config
│
├── e2e/                                # End-to-end tests (Playwright)
│   ├── smoke/                          # Smoke tests
│   └── *.spec.ts                       # Auth, bidding flow, merchant flow, network recovery, real-time sync
│
└── specs/                              # Feature specification documents
```

### Data Flow

```
Client (React SPA)
  │
  ├── REST API ──────────► Fastify Routes ──► Services ──► Repositories ──► MySQL (Persistence)
  │                                                 │
  └── WebSocket ─────────► Socket.IO ──► Handlers ──┤
                                                    └──► Redis (Leaderboard, CAS Locks, Cache, Rate Limiting)
                                                          │
                                                          └──► BullMQ (Async Job Queue)
```

---

## Prerequisites

| Dependency | Minimum Version | Description |
|------------|-----------------|-------------|
| **Node.js** | >= 18 | Runtime environment |
| **pnpm** | >= 8 | Package manager (recommended) |
| **MySQL** | >= 8.0 | Relational database |
| **Redis** | >= 7.0 | Cache and messaging middleware |
| **Docker** (optional) | >= 20 | For quick MySQL/Redis setup |

> ⚠️ **Windows users**: The `bcrypt` dependency requires native build tools. If installation fails, install [windows-build-tools](https://github.com/felixrieseberg/windows-build-tools) first.

---

## Getting Started

### 1. Clone the Project

```bash
git clone https://github.com/ylcmy/Live-Auction.git
cd Live-Auction
```

### 2. Start MySQL and Redis

```bash
# Option A: Quick Docker setup (recommended)
docker run -d --name auction-mysql \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=live_auction \
  -p 3306:3306 mysql:8

docker run -d --name auction-redis \
  -p 6379:6379 redis:7-alpine

# Option B: Use locally installed MySQL and Redis
# Ensure MySQL is running on port 3306, Redis on port 6379
```

### 3. Configure and Start Backend

```bash
cd backend
cp .env.example .env    # Copy environment template, edit as needed
pnpm install            # Install dependencies
pnpm migrate:latest     # Run database migrations
pnpm seed:run           # Load sample data
pnpm dev                # Start dev server (port 3001)
```

### 4. Start Frontend

```bash
# New terminal
cd frontend
pnpm install            # Install dependencies
pnpm dev                # Start Vite dev server (port 5173)
```

### 5. Open the App

Visit `http://localhost:5173` in your browser.

### Test Accounts

| Username | Password | Role | Nickname |
|----------|----------|------|----------|
| `merchant1` | `pass1234` | Merchant | Li Boss |
| `user1` | `pass1234` | User | Bidder Wang |
| `user2` | `pass1234` | User | Expert Li |

---

## Configuration

The backend is configured via environment variables. The template file is located at [backend/.env.example](backend/.env.example).

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server listen port |
| `NODE_ENV` | `development` | Runtime environment: `development` / `production` / `test` |
| `LOG_LEVEL` | `info` | Log level: `debug` / `info` / `warn` / `error` |
| **Database** | | |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL username |
| `DB_PASSWORD` | — | MySQL password |
| `DB_NAME` | `live_auction` | Database name |
| **Redis** | | |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL (with password: `redis://:password@host:port/db`) |
| **Authentication** | | |
| `JWT_SECRET` | — | JWT signing secret (**must be >= 32 chars in production**; generate with `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | `3600` | Access token expiration in seconds |
| `BCRYPT_COST` | `12` | bcrypt hashing rounds |
| **Security** | | |
| `CORS_ORIGINS` | — | Comma-separated CORS origins (required in production, `*` is forbidden) |

### Example Configuration

```bash
# Minimal development config
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=live_auction
REDIS_URL=redis://localhost:6379
JWT_SECRET=$(openssl rand -hex 32)
```

> 💡 **Note**: When `NODE_ENV=production`, the system enforces strict validation — `JWT_SECRET` must be >= 32 characters and `CORS_ORIGINS` must be non-empty. Startup will be blocked if validation fails.

---

## Available Scripts

### Backend (`backend/`)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start dev server with hot reload (tsx watch) |
| `pnpm build` | Compile TypeScript → `dist/` |
| `pnpm start` | Run production build |
| `pnpm test` | Run all unit + integration tests |
| `pnpm test:critical` | Run core path tests (domain/services/ws, 90% coverage threshold) |
| `pnpm test:integration` | Run integration tests only |
| `pnpm migrate:latest` | Run pending database migrations |
| `pnpm migrate:rollback` | Rollback last migration |
| `pnpm seed:run` | Seed database (test accounts + sample products) |
| `pnpm load:smoke` | Artillery smoke load test |

### Frontend (`frontend/`)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Vite dev server (port 5173) |
| `pnpm dev:test` | Start test-mode dev server (port 5174) |
| `pnpm build` | Type-check + production build |
| `pnpm preview` | Preview production build |
| `pnpm test` | Run component and hook tests |
| `pnpm typecheck` | Run TypeScript type checking |

### E2E Tests (Project Root)

| Script | Description |
|--------|-------------|
| `npx playwright test` | Run full E2E test suite |
| `npx playwright test --project=smoke` | Run smoke tests only |

---

## Database Design

The system uses **Knex.js** for database migration management with 19 migration files. Core table structure:

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

### Table Descriptions

| Table | Description |
|-------|-------------|
| `users` | Users table with merchant/user role distinction |
| `products` | Products table linked to merchants with status management |
| `auction_rules` | Auction rules table, one-to-one with products |
| `live_rooms` | Live rooms table managing online/offline status |
| `auction_sessions` | Auction sessions with optimistic lock `version` field. State: pending → active → ended/cancelled/unsold |
| `bid_records` | Bid records with `idempotency_key` unique constraint for idempotency |
| `orders` | Orders table. State: pending_payment → paid → completed / cancelled |

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new account |
| `POST` | `/api/auth/login` | Login (returns JWT token pair) |
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
| `bid:submit` | Client → Server | Submit a bid |
| `bid:new` | Server → Broadcast | New bid notification |
| `rank:update` | Server → Broadcast | Leaderboard update |
| `countdown:sync` | Server → Broadcast | Timer synchronization |
| `countdown:extend` | Server → Broadcast | Deadline extended |
| `auction:started` | Server → Broadcast | Auction started |
| `auction:ended` | Server → Broadcast | Auction ended |
| `emotion:lead` | Server → Client | You are leading |
| `emotion:overtaken` | Server → Client | You've been outbid |

---

## Testing

### Running Tests

```bash
# Backend — all tests
cd backend && pnpm test

# Backend — core path tests (high coverage threshold)
cd backend && pnpm test:critical

# Backend — integration tests (requires test MySQL + Redis)
cd backend && pnpm test:integration

# Frontend — component and hook tests
cd frontend && pnpm test

# E2E — end-to-end tests (requires frontend and backend services running)
cd e2e && npx playwright test
```

### Test Environment Docker (for Integration Tests)

```bash
# Start test-dedicated MySQL and Redis (different ports to avoid conflicts)
cd backend
docker compose -f docker-compose.test.yml up -d

# Run integration tests
pnpm test:integration
```

### Test Structure

```
backend/tests/
├── unit/                               # Unit tests (pure functions, mocked dependencies)
│   ├── domain/                         #   auction.test.ts, bid.test.ts
│   ├── services/                       #   auction.service, bid.service, auth.service, order.service, etc.
│   ├── middleware/                      #   auth, error-handler, rate-limiter
│   ├── ws/                             #   auction-handler, bid-handler, bid-event-bus
│   └── lib/                            #   app-error, paginate, reply, case-transform, input-boundary
├── integration/                        # Integration tests (real database connections)
│   ├── api/                            #   REST endpoints: auth, auction, bid-idempotency, order, product, room
│   └── ws/                             #   WebSocket scenarios: concurrent bidding, countdown sync, reconnect, etc.

frontend/src/**/__tests__/              # Frontend tests (27 test files)
├── components/auction/__tests__/       #   BidButton, BidSheet, CartPanel, Leaderboard, Countdown, etc.
├── hooks/__tests__/                    #   useBid, useCountdown, useWebSocket, useCart, useAudio
├── store/__tests__/                    #   authStore, auctionStore
├── services/__tests__/                 #   api, socket
└── lib/__tests__/                      #   cn, idempotency, jwt, format, statusConfig

e2e/                                    # E2E tests (Playwright)
├── smoke/                              #   Smoke tests: core bidding flow
├── auth.spec.ts                        #   Authentication flow
├── bidding-flow.spec.ts                #   Complete bidding flow
├── merchant-flow.spec.ts               #   Merchant operations
├── network-recovery.spec.ts            #   Network disconnect/recovery
└── realtime-sync.spec.ts               #   Multi-client real-time sync
```

---

## Key Design Decisions

### Redis-First Hot Path

Leaderboards (Sorted Set), CAS bid locks (Lua atomic scripts), rate limiting (sliding window), and countdown timers all reside in Redis for sub-millisecond latency. MySQL persistence happens asynchronously via `setImmediate`, keeping the bidding path non-blocking.

### Domain-Driven Layering

Pure functions in `domain/` handle bid validation and auction state transitions with zero side effects, making them highly testable. Services orchestrate business workflows, coordinating domain logic with infrastructure. Routes handle HTTP/WS transport only.

### CAS Optimistic Bidding

Redis Lua scripts implement Compare-And-Swap atomic operations, replacing traditional global locks. Combined with the `auction_sessions.version` database optimistic lock, this achieves lock-free bidding under high concurrency, preventing race conditions.

### Asynchronous Event Broadcasting

After a successful bid, the response is returned immediately. Leaderboard updates and event broadcasting are pushed asynchronously through the event bus, reducing bid path latency.

### WebSocket Room Isolation

Each live room maps to a Socket.IO room with isolated state. On reconnect, auction state is broadcast per-user individually, ensuring late joiners see accurate data.

### Circuit Breaker Degradation

When Redis becomes unavailable, the system automatically degrades to database queries. When Redis recovers, the cache is rebuilt automatically, ensuring system availability.

---

## CI/CD

The project uses **GitHub Actions** for automated CI/CD pipelines with 4 parallel jobs:

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

| Job | Trigger | Description |
|-----|---------|-------------|
| Frontend Tests | Push / PR → main, develop | Vitest unit tests + coverage report |
| Backend Tests | Push / PR → main, develop | MySQL 8 + Redis 7 service containers → migrations → unit + integration tests |
| E2E Tests | After frontend & backend pass | Playwright smoke tests (Chromium) |
| Load Smoke | After backend tests | k6 load smoke test |

---

## License

This project is for educational and demonstration purposes.

---

<div align="center">

**Built with care using TypeScript, React, and Fastify**

If you find this project helpful, please give it a ⭐ Star!

</div>
