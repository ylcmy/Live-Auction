import { Knex } from 'knex';

async function columnExists(knex: Knex, table: string, column: string): Promise<boolean> {
  const result = await knex.raw(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(result[0][0]?.cnt || result[0]?.cnt) > 0;
}

export async function up(knex: Knex): Promise<void> {
  const columns = ['paid_at', 'cancelled_at', 'completed_at', 'expire_at', 'payment_method', 'transaction_id'];
  const existsMap: Record<string, boolean> = {};
  for (const col of columns) {
    existsMap[col] = await columnExists(knex, 'orders', col);
  }

  await knex.schema.alterTable('orders', (t) => {
    if (!existsMap['paid_at']) t.timestamp('paid_at').nullable();
    if (!existsMap['cancelled_at']) t.timestamp('cancelled_at').nullable();
    if (!existsMap['completed_at']) t.timestamp('completed_at').nullable();
    if (!existsMap['expire_at']) t.timestamp('expire_at').notNullable().defaultTo(knex.fn.now());
    if (!existsMap['payment_method']) t.string('payment_method', 20).nullable();
    if (!existsMap['transaction_id']) t.string('transaction_id', 64).nullable();
  });

  // Also ensure status enum includes 'completed'
  const hasCompleted = await knex.raw(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'status' AND COLUMN_TYPE LIKE '%completed%'`
  );
  if (Number(hasCompleted[0][0]?.cnt || hasCompleted[0]?.cnt) === 0) {
    await knex.raw(`ALTER TABLE orders MODIFY COLUMN status ENUM('pending_payment', 'paid', 'cancelled', 'completed') NOT NULL DEFAULT 'pending_payment'`);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Skip reverting status enum if there are 'completed' rows to avoid data truncation
  const completedCount = await knex('orders').where({ status: 'completed' }).count('* as cnt').first();
  if (Number((completedCount as any)?.cnt || 0) > 0) {
    // Cannot safely revert enum when completed rows exist
    return;
  }

  const columns = ['paid_at', 'cancelled_at', 'completed_at', 'expire_at', 'payment_method', 'transaction_id'];
  const existsMap: Record<string, boolean> = {};
  for (const col of columns) {
    existsMap[col] = await columnExists(knex, 'orders', col);
  }

  await knex.schema.alterTable('orders', (t) => {
    if (existsMap['paid_at']) t.dropColumn('paid_at');
    if (existsMap['cancelled_at']) t.dropColumn('cancelled_at');
    if (existsMap['completed_at']) t.dropColumn('completed_at');
    if (existsMap['expire_at']) t.dropColumn('expire_at');
    if (existsMap['payment_method']) t.dropColumn('payment_method');
    if (existsMap['transaction_id']) t.dropColumn('transaction_id');
  });

  // Revert status enum only if safe
  await knex.raw(`ALTER TABLE orders MODIFY COLUMN status ENUM('pending_payment', 'paid', 'cancelled') NOT NULL DEFAULT 'pending_payment'`);
}
