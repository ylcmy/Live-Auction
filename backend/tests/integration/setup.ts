import { buildApp } from '../../src/app.js';
import { FastifyInstance } from 'fastify';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { truncateAll } from '../helpers/factory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

/** Schema comes from Knex migrations (global-setup); per-test cleanup uses truncate only. */
export async function setupTestApp(): Promise<FastifyInstance> {
  return buildApp();
}

export async function teardownTestApp(app?: FastifyInstance): Promise<void> {
  if (app) await app.close();
  await truncateAll();
}
