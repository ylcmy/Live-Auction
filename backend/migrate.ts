/**
 * 运行数据库迁移（Docker/Render 部署用）
 * 绕过 knex CLI，直接使用编程 API，避免 TS 配置文件加载问题
 */
import knex from 'knex';
import { env } from './src/config/env.js';

const db = knex({
  client: 'mysql2',
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL ? { rejectUnauthorized: true } : undefined,
  },
});

try {
  const [batchNo, log] = await db.migrate.latest({
    directory: './src/infrastructure/db/migrations',
  });
  if (log.length === 0) {
    console.log('数据库已是最新，无需迁移');
  } else {
    console.log(`迁移完成: batch ${batchNo}, 执行了 ${log.length} 个迁移`);
    log.forEach((file) => console.log(`  ✓ ${file}`));
  }
} catch (err) {
  console.error('迁移失败:', err);
  process.exit(1);
} finally {
  await db.destroy();
}
