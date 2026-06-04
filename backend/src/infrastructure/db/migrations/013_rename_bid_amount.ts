import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bid_records', (t) => {
    t.renameColumn('amount', 'bid_amount');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('bid_records', (t) => {
    t.renameColumn('bid_amount', 'amount');
  });
}
