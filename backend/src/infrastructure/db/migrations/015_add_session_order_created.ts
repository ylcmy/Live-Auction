import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('auction_sessions', (table) => {
    table.boolean('order_created').defaultTo(true).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('auction_sessions', (table) => {
    table.dropColumn('order_created');
  });
}
