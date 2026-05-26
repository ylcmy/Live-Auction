import { buildApp } from '../../src/app.js';
import { FastifyInstance } from 'fastify';
import { db } from '../../src/infrastructure/db/knex.js';

export async function setupTestApp(): Promise<FastifyInstance> {
  // Run migrations on test database
  await db.migrate.latest();
  return buildApp();
}

export async function teardownTestApp(app: FastifyInstance) {
  await app.close();
  // Clean test data
  await db('bid_records').del();
  await db('orders').del();
  await db('auction_sessions').del();
  await db('auction_rules').del();
  await db('products').del();
  await db('live_rooms').del();
  await db('users').del();
}
