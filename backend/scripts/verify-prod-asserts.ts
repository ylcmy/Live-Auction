// Verify production-mode assertions in env.ts.
// 1. with NODE_ENV=production + insecure JWT_SECRET  -> should THROW
// 2. with NODE_ENV=production + strong JWT_SECRET     -> should NOT throw
// 3. with NODE_ENV=production + insecure CORS_ORIGINS-> should THROW
import { spawnSync } from 'child_process';
import path from 'path';

function run(env: Record<string, string>): { ok: boolean; stdout: string; stderr: string; code: number } {
  const r = spawnSync(
    process.execPath,
    ['--import', 'tsx', path.resolve('scripts/smoke-security.ts')],
    { env: { ...process.env, ...env }, encoding: 'utf8' },
  );
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr, code: r.status ?? -1 };
}

const cases: Array<{ name: string; env: Record<string, string>; expect: 'throw' | 'ok' }> = [
  {
    name: 'prod + insecure JWT_SECRET',
    env: { NODE_ENV: 'production', JWT_SECRET: 'dev-secret-change-in-production' },
    expect: 'throw',
  },
  {
    name: 'prod + insecure CORS_ORIGINS',
    env: { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(40), CORS_ORIGINS: '*' },
    expect: 'throw',
  },
  {
    name: 'prod + missing CORS_ORIGINS',
    env: { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(40), CORS_ORIGINS: '' },
    expect: 'throw',
  },
  {
    name: 'prod + strong JWT_SECRET + valid CORS',
    env: {
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(40),
      CORS_ORIGINS: 'https://app.example.com',
    },
    expect: 'ok',
  },
];

let pass = 0;
for (const c of cases) {
  const r = run(c.env);
  const threw = r.code !== 0;
  const matches = c.expect === 'throw' ? threw : !threw;
  console.log(
    `${matches ? 'PASS' : 'FAIL'} | ${c.name} | exit=${r.code} | ${(r.stdout + r.stderr).split('\n').find((l) => l.includes('FATAL')) ?? ''}`,
  );
  if (matches) pass++;
}
console.log(`\n${pass}/${cases.length} cases passed`);
process.exit(pass === cases.length ? 0 : 1);
