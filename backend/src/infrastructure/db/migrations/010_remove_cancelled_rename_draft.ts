import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE products MODIFY COLUMN status ENUM('draft','pending','listed','active','ended','unsold','cancelled','deleted') NOT NULL DEFAULT 'pending'`,
  );
  await knex('products').where({ status: 'cancelled' }).update({ status: 'pending' });
  await knex('products').where({ status: 'draft' }).update({ status: 'pending' });
  await knex.raw(
    `ALTER TABLE products MODIFY COLUMN status ENUM('pending','listed','active','ended','unsold','deleted') NOT NULL DEFAULT 'pending'`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE products MODIFY COLUMN status ENUM('draft','pending','listed','active','ended','unsold','cancelled','deleted') NOT NULL DEFAULT 'draft'`,
  );
  await knex('products').where({ status: 'pending' }).update({ status: 'draft' });
  await knex.raw(
    `ALTER TABLE products MODIFY COLUMN status ENUM('draft','listed','active','ended','unsold','cancelled','deleted') NOT NULL DEFAULT 'draft'`,
  );
}
