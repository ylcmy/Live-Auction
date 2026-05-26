import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('bid_records', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('session_id').unsigned().notNullable()
      .references('id').inTable('auction_sessions');
    t.bigInteger('user_id').unsigned().notNullable()
      .references('id').inTable('users');
    t.decimal('bid_amount', 12, 2).notNullable();
    t.string('idempotency_key', 64).unique().notNullable();
    t.timestamp('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    t.index(['session_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bid_records');
}
