import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('live_rooms', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('host_id').unsigned().notNullable()
      .references('id').inTable('users');
    t.string('title', 200).notNullable();
    t.enu('status', ['offline', 'live']).notNullable().defaultTo('offline');
    t.string('stream_url', 500).nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('live_rooms');
}
