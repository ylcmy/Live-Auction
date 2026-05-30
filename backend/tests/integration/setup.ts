import { buildApp } from '../../src/app.js';
import { FastifyInstance } from 'fastify';
import { db } from '../../src/infrastructure/db/knex.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load test environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

export async function setupTestApp(): Promise<FastifyInstance> {
  // Drop and recreate tables for clean test state
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['orders', 'bid_records', 'auction_sessions', 'auction_rules', 'products', 'live_rooms', 'users']) {
    await db.raw(`DROP TABLE IF EXISTS ${table}`);
  }
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');

  // Create tables with full schema
  await db.raw(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      password VARCHAR(255) DEFAULT '',
      role ENUM('user', 'merchant') NOT NULL DEFAULT 'user',
      nickname VARCHAR(255) DEFAULT '',
      avatar VARCHAR(500) DEFAULT '',
      avatar_url VARCHAR(500) DEFAULT '',
      phone VARCHAR(50) DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await db.raw(`
    CREATE TABLE IF NOT EXISTS live_rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      host_id INT NOT NULL,
      status ENUM('live', 'offline') NOT NULL DEFAULT 'offline',
      stream_url VARCHAR(500),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (host_id) REFERENCES users(id)
    )
  `);
  await db.raw(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      images TEXT,
      category VARCHAR(100) DEFAULT '',
      image_url VARCHAR(500) DEFAULT '',
      start_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      owner_id INT,
      merchant_id INT,
      room_id INT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);
  await db.raw(`
    CREATE TABLE IF NOT EXISTS auction_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      start_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      bid_increment DECIMAL(10,2) NOT NULL DEFAULT 10,
      ceiling_price DECIMAL(10,2),
      duration_seconds INT NOT NULL DEFAULT 60,
      extend_seconds INT NOT NULL DEFAULT 20,
      max_extensions INT NOT NULL DEFAULT 10,
      created_at DATETIME NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
  await db.raw(`
    CREATE TABLE IF NOT EXISTS auction_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      room_id INT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      current_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      winner_id INT,
      ends_at DATETIME,
      started_at DATETIME,
      ended_at DATETIME,
      extend_count INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
  await db.raw(`
    CREATE TABLE IF NOT EXISTS bid_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      idempotency_key VARCHAR(255),
      created_at DATETIME NOT NULL,
      FOREIGN KEY (session_id) REFERENCES auction_sessions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  await db.raw(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      user_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending_payment',
      transaction_id VARCHAR(255),
      paid_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES auction_sessions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  return buildApp();
}

export async function teardownTestApp(app?: FastifyInstance) {
  if (app) await app.close();
  // Truncate tables for fast cleanup, respecting FK constraints
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  await db('bid_records').truncate();
  await db('orders').truncate();
  await db('auction_sessions').truncate();
  await db('auction_rules').truncate();
  await db('products').truncate();
  await db('live_rooms').truncate();
  await db('users').truncate();
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');
}
