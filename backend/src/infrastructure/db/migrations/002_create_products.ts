import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('products', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('merchant_id').unsigned().notNullable()
      .references('id').inTable('users');
    t.string('name', 200).notNullable();
    t.text('description').nullable();
    t.string('image_url', 500).nullable();
    t.string('category', 100).nullable();
    t.enu('status', ['draft', 'pending', 'active', 'ended', 'cancelled', 'unsold'])
      .notNullable().defaultTo('draft');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('products');
}
