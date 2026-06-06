import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const result = await knex.raw(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'live_rooms' AND COLUMN_NAME = 'updated_at'`,
  );
  if (Number(result[0][0]?.cnt || 0) === 0) {
    await knex.schema.alterTable('live_rooms', (t) => {
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('live_rooms', (t) => {
    t.dropColumn('updated_at');
  });
}
