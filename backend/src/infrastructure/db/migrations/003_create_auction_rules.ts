import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('auction_rules', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('product_id').unsigned().notNullable().unique()
      .references('id').inTable('products');
    t.decimal('start_price', 12, 2).notNullable().defaultTo(0);
    t.decimal('bid_increment', 12, 2).notNullable();
    t.decimal('ceiling_price', 12, 2).nullable();
    t.integer('duration_seconds').notNullable();
    t.integer('extend_seconds').notNullable();
    t.integer('max_extensions').notNullable().defaultTo(10);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('auction_rules');
}
