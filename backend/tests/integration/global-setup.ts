import { prepareTestEnvironment } from '../../scripts/lib/prepare-test-env.js';

export default async function globalSetup(): Promise<void> {
  const skipDocker = process.env.SKIP_DOCKER_PREPARE === '1';
  await prepareTestEnvironment({ skipDocker });
}
