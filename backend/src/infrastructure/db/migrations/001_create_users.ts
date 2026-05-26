import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('username', 50).unique().notNullable();
    t.string('password_hash', 255).notNullable();
    t.enu('role', ['merchant', 'user']).notNullable().defaultTo('user');
    t.string('nickname', 100).notNullable();
    t.string('avatar_url', 500).nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
