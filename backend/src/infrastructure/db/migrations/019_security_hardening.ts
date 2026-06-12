import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Extend users.role ENUM to add 'admin'
  await knex.raw(`
    ALTER TABLE users
    MODIFY COLUMN role ENUM('merchant', 'user', 'admin') NOT NULL DEFAULT 'user'
  `);

  // 2. Create merchant_applications table
  await knex.schema.createTable('merchant_applications', (table) => {
    table.bigIncrements('id').unsigned();
    table.bigInteger('user_id').unsigned().notNullable().unique()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('shop_name', 100).notNullable();
    table.string('reason', 500).nullable();
    table.enum('status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending');
    table.bigInteger('reviewer_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('reviewed_at').nullable();
    table.timestamps(true, true);

    table.index('status', 'idx_merchant_applications_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('merchant_applications');

  // Revert users.role ENUM
  await knex.raw(`
    ALTER TABLE users
    MODIFY COLUMN role ENUM('merchant', 'user') NOT NULL DEFAULT 'user'
  `);
}
