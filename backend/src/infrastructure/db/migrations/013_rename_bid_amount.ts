import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Use raw SQL to avoid Knex 3.x MySQL renameColumn bug (column.Type undefined)
  const hasColumn = await knex.schema.hasColumn('bid_records', 'amount');
  if (hasColumn) {
    await knex.raw('ALTER TABLE `bid_records` CHANGE `amount` `bid_amount` DECIMAL(10,2) NOT NULL');
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('bid_records', 'bid_amount');
  if (hasColumn) {
    await knex.raw('ALTER TABLE `bid_records` CHANGE `bid_amount` `amount` DECIMAL(10,2) NOT NULL');
  }
}
