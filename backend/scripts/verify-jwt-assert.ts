// Specifically verify the JWT_SECRET assertion when CORS is already valid.
import { spawnSync } from 'child_process';
import path from 'path';

function run(env: Record<string, string>) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', path.resolve('scripts/smoke-security.ts')],
    { env: { ...process.env, ...env }, encoding: 'utf8' },
  );
}

const cases = [
  {
    name: 'prod + short JWT_SECRET (5 chars) + valid CORS',
    env: { NODE_ENV: 'production', JWT_SECRET: 'short', CORS_ORIGINS: 'https://x.com' },
    expectThrow: true,
  },
  {
    name: 'prod + default JWT_SECRET (31 chars) + valid CORS',
    env: {
      NODE_ENV: 'production',
      JWT_SECRET: 'dev-secret-change-in-production',
      CORS_ORIGINS: 'https://x.com',
    },
    expectThrow: true,
  },
  {
    name: 'prod + strong JWT_SECRET (40 chars) + valid CORS',
    env: { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(40), CORS_ORIGINS: 'https://x.com' },
    expectThrow: false,
  },
];

let pass = 0;
for (const c of cases) {
  const r = run(c.env);
  const threw = (r.status ?? -1) !== 0;
  const match = threw === c.expectThrow;
  const fatal = (r.stdout + r.stderr).split('\n').find((l) => l.toLowerCase().includes('fatal'));
  console.log(`${match ? 'PASS' : 'FAIL'} | ${c.name} | threw=${threw} | ${fatal ?? ''}`);
  if (match) pass++;
}
console.log(`\n${pass}/${cases.length} JWT_SECRET cases passed`);
process.exit(pass === cases.length ? 0 : 1);
