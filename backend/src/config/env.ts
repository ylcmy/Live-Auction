import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In test environment, load .env.test first so its values take priority.
// .env is loaded second but dotenv won't overwrite existing keys.
const envTestPath = resolve(__dirname, '../../.env.test');
const isTestEnv = process.env.NODE_ENV === 'test';
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
  // bcrypt cost factor. 10 ≈ 100ms / 12 ≈ 400ms per hash on modern hardware.
  // Existing hashes are self-describing (cost is stored in the hash) so this
  // value only affects NEW passwords — it does not invalidate legacy hashes.
  BCRYPT_COST: parseInt(process.env.BCRYPT_COST || '12', 10),
  // Comma-separated CORS whitelist. Empty means use the built-in dev defaults.
  // In production this MUST be set explicitly (e.g. "https://app.example.com,https://admin.example.com").
  CORS_ORIGINS: process.env.CORS_ORIGINS || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  // Trust X-Forwarded-For header from reverse proxy (Render.com, Nginx, etc.)
  // Required for accurate req.ip extraction behind a load balancer.
  TRUST_PROXY: process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production',
  // Comma-separated IP whitelist for rate limiter (skips 429 enforcement).
  // Default includes loopback addresses for local development convenience.
  IP_RATE_LIMIT_WHITELIST:
    process.env.IP_RATE_LIMIT_WHITELIST || '127.0.0.1,::1,::ffff:127.0.0.1',
  // AI
  AI_PROVIDER: process.env.AI_PROVIDER || 'deepseek',
  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_BASE_URL: process.env.AI_BASE_URL || 'https://api.deepseek.com',
  AI_MODEL: process.env.AI_MODEL || 'deepseek-chat',
  AI_MAX_TOKENS: parseInt(process.env.AI_MAX_TOKENS || '2048', 10),
  AI_REQUESTS_PER_MINUTE: parseInt(process.env.AI_REQUESTS_PER_MINUTE || '20', 10),
};

/**
 * Parse CORS_ORIGINS env into a list. Returns:
 * - string[]  : explicit whitelist
 * - ['*']     : allow any origin WITHOUT credentials (dev/test fallback)
 * - throws    : production with empty value or with '*' (credentials + wildcard is forbidden)
 */
function parseCorsOrigins(): string[] | true {
  const raw = env.CORS_ORIGINS.trim();
  if (env.NODE_ENV === 'production') {
    if (!raw) {
      throw new Error(
        '[FATAL] CORS_ORIGINS must be set in production. ' +
          'Provide a comma-separated whitelist, e.g. "https://app.example.com".',
      );
    }
    if (raw === '*') {
      throw new Error(
        "[FATAL] CORS_ORIGINS='*' is not allowed in production when credentials are enabled. " +
          'Use an explicit whitelist instead.',
      );
    }
  }
  if (!raw) return true; // dev/test default: allow all (no credentials with wildcard)
  if (raw === '*') return true; // dev convenience: wildcard without credentials
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

export const CORS_WHITELIST: string[] | true = parseCorsOrigins();

/**
 * Weak / known-insecure JWT secrets that must never be used outside development.
 * If a project ships with one of these defaults, attackers can forge tokens trivially.
 */
const FORBIDDEN_JWT_SECRETS = new Set<string>([
  'dev-secret-change-in-production',
  'secret',
  'changeme',
  'password',
  '123456',
  'jwt-secret',
  'your-secret-key',
]);

const MIN_JWT_SECRET_LENGTH = 32;

function assertJwtSecret(): void {
  const secret = env.JWT_SECRET;
  const isProduction = env.NODE_ENV === 'production';

  if (FORBIDDEN_JWT_SECRETS.has(secret)) {
    const msg = `[FATAL] JWT_SECRET is set to a known-insecure default ("${secret}"). ` +
      'Generate a strong random value (e.g. `openssl rand -hex 32`) and set it via the JWT_SECRET env var.';
    if (isProduction) throw new Error(msg);
    // eslint-disable-next-line no-console
    console.warn(`[SECURITY WARNING] ${msg} (NODE_ENV=${env.NODE_ENV}, ignored in non-production)`);
    return;
  }

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    const msg = `[FATAL] JWT_SECRET is too short (${secret.length} < ${MIN_JWT_SECRET_LENGTH} chars). ` +
      'Use a cryptographically random value of at least 32 characters.';
    if (isProduction) throw new Error(msg);
    // eslint-disable-next-line no-console
    console.warn(`[SECURITY WARNING] ${msg} (NODE_ENV=${env.NODE_ENV}, ignored in non-production)`);
  }
}

assertJwtSecret();
