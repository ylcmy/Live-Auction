import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (t) => {
    t.timestamp('paid_at').nullable();
    t.timestamp('cancelled_at').nullable();
    t.timestamp('completed_at').nullable();
    t.timestamp('expire_at').notNullable().defaultTo(knex.fn.now());
    t.string('payment_method', 20).nullable();
    t.string('transaction_id', 64).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (t) => {
    t.dropColumn('paid_at');
    t.dropColumn('cancelled_at');
    t.dropColumn('completed_at');
    t.dropColumn('expire_at');
    t.dropColumn('payment_method');
    t.dropColumn('transaction_id');
  });
}
