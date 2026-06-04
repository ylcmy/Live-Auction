import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bid_records', (t) => {
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)')).alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bid_records', (t) => {
    t.datetime('created_at').notNullable().alter();
  });
}
