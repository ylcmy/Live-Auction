import { Knex } from 'knex';

async function columnExists(knex: Knex, table: string, column: string): Promise<boolean> {
  const result = await knex.raw(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(result[0][0]?.cnt || result[0]?.cnt) > 0;
}

async function fkExists(knex: Knex, table: string, fkName: string): Promise<boolean> {
  const result = await knex.raw(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [table, fkName]
  );
  return Number(result[0][0]?.cnt || result[0]?.cnt) > 0;
}

export async function up(knex: Knex): Promise<void> {
  // ============================================
  // 1. Fix users table - remove extra columns
  // ============================================
  const usersExtra = ['password', 'avatar', 'phone'];
  const usersHasExtra = (await Promise.all(usersExtra.map(c => columnExists(knex, 'users', c)))).some(Boolean);
  if (usersHasExtra) {
    const drops: string[] = [];
    for (const col of usersExtra) {
      if (await columnExists(knex, 'users', col)) drops.push(`DROP COLUMN \`${col}\``);
    }
    if (drops.length > 0) {
      await knex.raw(`ALTER TABLE users ${drops.join(', ')}`);
    }
  }

  // ============================================
  // 2. Fix products table - remove extra columns
  // ============================================
  if (await fkExists(knex, 'products', 'products_ibfk_1')) {
    await knex.raw('ALTER TABLE products DROP FOREIGN KEY products_ibfk_1');
  }
  const productsExtra = ['owner_id', 'images', 'start_price'];
  const productsHasExtra = (await Promise.all(productsExtra.map(c => columnExists(knex, 'products', c)))).some(Boolean);
  if (productsHasExtra) {
    const drops: string[] = [];
    for (const col of productsExtra) {
      if (await columnExists(knex, 'products', col)) drops.push(`DROP COLUMN \`${col}\``);
    }
    if (drops.length > 0) {
      await knex.raw(`ALTER TABLE products ${drops.join(', ')}`);
    }
  }

  // ============================================
  // 3. Fix auction_sessions table - rename extend_count to extension_count
  // ============================================
  if (await columnExists(knex, 'auction_sessions', 'extend_count')) {
    await knex.raw('ALTER TABLE auction_sessions CHANGE extend_count extension_count INT NOT NULL DEFAULT 0');
  }

  // ============================================
  // 4. Fix orders table - rename columns to match migration
  // ============================================
  if (await fkExists(knex, 'orders', 'orders_ibfk_2')) {
    await knex.raw('ALTER TABLE orders DROP FOREIGN KEY orders_ibfk_2');
  }
  if (await columnExists(knex, 'orders', 'user_id')) {
    await knex.raw('ALTER TABLE orders CHANGE user_id buyer_id INT NOT NULL');
  }
  if (await columnExists(knex, 'orders', 'amount')) {
    await knex.raw('ALTER TABLE orders CHANGE amount final_price DECIMAL(12,2) NOT NULL');
  }

  // Add product_id if not exists
  if (!(await columnExists(knex, 'orders', 'product_id'))) {
    await knex.schema.alterTable('orders', (t) => {
      t.bigInteger('product_id').unsigned().notNullable().defaultTo(0);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Revert users
  await knex.schema.alterTable('users', (t) => {
    t.string('password', 255).nullable();
    t.string('avatar', 500).nullable();
    t.string('phone', 50).nullable();
  });

  // Revert products
  await knex.schema.alterTable('products', (t) => {
    t.bigInteger('owner_id').unsigned().nullable();
    t.text('images').nullable();
    t.decimal('start_price', 10, 2).notNullable().defaultTo(0);
  });
  await knex.raw('ALTER TABLE products ADD CONSTRAINT products_ibfk_1 FOREIGN KEY (owner_id) REFERENCES users(id)');

  // Revert auction_sessions
  await knex.raw('ALTER TABLE auction_sessions CHANGE extension_count extend_count INT NOT NULL DEFAULT 0');

  // Revert orders
  await knex.raw('ALTER TABLE orders CHANGE buyer_id user_id INT NOT NULL');
  await knex.raw('ALTER TABLE orders CHANGE final_price amount DECIMAL(10,2) NOT NULL');
  await knex.raw('ALTER TABLE orders ADD CONSTRAINT orders_ibfk_2 FOREIGN KEY (user_id) REFERENCES users(id)');
}
