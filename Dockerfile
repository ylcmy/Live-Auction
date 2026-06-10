# ─── Build Stage ───
FROM node:20-alpine AS builder

# bcrypt 需要原生编译工具
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# 先复制依赖清单（利用 Docker 层缓存）
COPY backend/package.json backend/pnpm-lock.yaml ./backend/
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/

# 安装所有依赖
RUN cd backend && pnpm install --frozen-lockfile
RUN cd frontend && pnpm install --frozen-lockfile

# 复制源码
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# 构建前端（Vite → frontend/dist）
RUN cd frontend && pnpm build

# 构建后端（TypeScript → backend/dist）
RUN cd backend && pnpm build

# ─── Production Stage ───
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

# 复制后端：编译产物 + 完整 node_modules（含 bcrypt 原生绑定）
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/package.json

# 复制后端 TS 源码中的 migrations 和 knexfile（tsx 运行时需要）
COPY --from=builder /app/backend/src/infrastructure/db/migrations ./backend/src/infrastructure/db/migrations
COPY --from=builder /app/backend/knexfile.js ./backend/knexfile.js

# 复制前端构建产物（后端在 production 模式下 serve）
COPY --from=builder /app/frontend/dist ./frontend/dist

# 全局安装 tsx（运行 TypeScript migrations 需要）
RUN npm install -g tsx

USER appuser

EXPOSE 3001
ENV NODE_ENV=production

WORKDIR /app/backend
CMD ["sh", "-c", "tsx node_modules/knex/bin/cli.js migrate:latest --knexfile knexfile.js && node dist/server.js"]
