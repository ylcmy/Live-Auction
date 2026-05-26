import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('auction_sessions', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('product_id').unsigned().notNullable()
      .references('id').inTable('products');
    t.bigInteger('rule_id').unsigned().notNullable()
      .references('id').inTable('auction_rules');
    t.bigInteger('room_id').unsigned().notNullable()
      .references('id').inTable('live_rooms');
    t.enu('status', ['pending', 'active', 'ended', 'cancelled', 'unsold'])
      .notNullable().defaultTo('pending');
    t.decimal('current_price', 12, 2).notNullable().defaultTo(0);
    t.bigInteger('winner_id').unsigned().nullable()
      .references('id').inTable('users');
    t.timestamp('started_at').nullable();
    t.timestamp('ended_at').nullable();
    t.integer('extension_count').notNullable().defaultTo(0);
    t.integer('version').notNullable().defaultTo(0);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('auction_sessions');
}
