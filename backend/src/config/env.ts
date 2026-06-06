import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In test environment, load .env.test first so its values take priority.
// .env is loaded second but dotenv won't overwrite existing keys.
const envTestPath = resolve(__dirname, '../../.env.test');
const isTestEnv = process.env.NODE_ENV === 'test' || existsSync(envTestPath);
if (isTestEnv && existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
}
dotenv.config({ path: resolve(__dirname, '../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || 'root123',
  DB_NAME: process.env.DB_NAME || 'live_auction',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  JWT_EXPIRES_IN: parseInt(process.env.JWT_EXPIRES_IN || '3600', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
