import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE products MODIFY COLUMN status ENUM('draft','pending','listed','active','ended','unsold','cancelled','deleted') NOT NULL DEFAULT 'draft'`,
  );
  await knex('products').where({ status: 'pending' }).update({ status: 'listed' });
  await knex.raw(
    `ALTER TABLE products MODIFY COLUMN status ENUM('draft','listed','active','ended','unsold','cancelled','deleted') NOT NULL DEFAULT 'draft'`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE products MODIFY COLUMN status ENUM('draft','pending','listed','active','ended','unsold','cancelled','deleted') NOT NULL DEFAULT 'draft'`,
  );
  await knex('products').where({ status: 'listed' }).update({ status: 'pending' });
  await knex.raw(
    `ALTER TABLE products MODIFY COLUMN status ENUM('draft','pending','active','ended','cancelled','unsold') NOT NULL DEFAULT 'draft'`,
  );
}
