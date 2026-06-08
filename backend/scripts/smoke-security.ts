// Quick smoke test for the security hardening changes.
// Run with: pnpm exec tsx scripts/smoke-security.ts
import bcrypt from 'bcrypt';
import { env } from '../src/config/env.js';

async function main() {
  // 1. bcrypt cost 12 timing
  const t0 = Date.now();
  const h = await bcrypt.hash('pass1234', env.BCRYPT_COST);
  const ms = Date.now() - t0;
  const ok = await bcrypt.compare('pass1234', h);
  console.log(`[bcrypt] cost=${env.BCRYPT_COST} hash=${ms}ms verify=${ok} hashSample=${h.slice(0, 7)}...`);

  // 2. A pre-existing cost-10 hash still verifies (backwards compatibility).
  const legacy = await bcrypt.hash('pass1234', 10);
  const legacyOk = await bcrypt.compare('pass1234', legacy);
  console.log(`[bcrypt] legacy cost-10 hash still verifies: ${legacyOk} sample=${legacy.slice(0, 7)}...`);

  // 3. env assertions
  console.log(`[env] BCRYPT_COST = ${env.BCRYPT_COST}`);
  console.log(`[env] CORS_WHITELIST = ${JSON.stringify(CORS_WHITELIST_FOR_LOG)}`);
  console.log(`[env] JWT_SECRET length = ${env.JWT_SECRET.length}`);
}

import { CORS_WHITELIST } from '../src/config/env.js';
const CORS_WHITELIST_FOR_LOG = CORS_WHITELIST;

main().catch((e) => { console.error(e); process.exit(1); });
