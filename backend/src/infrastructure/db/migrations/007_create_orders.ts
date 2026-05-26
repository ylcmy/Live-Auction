import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('orders', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('session_id').unsigned().notNullable().unique()
      .references('id').inTable('auction_sessions');
    t.bigInteger('buyer_id').unsigned().notNullable()
      .references('id').inTable('users');
    t.bigInteger('product_id').unsigned().notNullable()
      .references('id').inTable('products');
    t.decimal('final_price', 12, 2).notNullable();
    t.enu('status', ['pending_payment', 'paid', 'cancelled'])
      .notNullable().defaultTo('pending_payment');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('orders');
}
