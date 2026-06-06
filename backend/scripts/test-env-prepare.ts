#!/usr/bin/env tsx
/**
 * CLI: prepare Docker test stack, run migrations, flush Redis.
 * See specs/005-comprehensive-auction-testing/quickstart.md
 */

import { prepareTestEnvironment } from './lib/prepare-test-env.js';

const assertDuration = process.argv.includes('--assert-duration');

await prepareTestEnvironment({
  assertMaxDurationMs: assertDuration ? 120_000 : undefined,
});
