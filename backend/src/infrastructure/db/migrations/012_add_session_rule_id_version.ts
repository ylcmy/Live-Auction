import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasRuleId = await knex.schema.hasColumn('auction_sessions', 'rule_id');
  if (!hasRuleId) {
    await knex.schema.alterTable('auction_sessions', (t) => {
      t.bigInteger('rule_id').unsigned().notNullable().defaultTo(0);
    });
  }

  const hasVersion = await knex.schema.hasColumn('auction_sessions', 'version');
  if (!hasVersion) {
    await knex.schema.alterTable('auction_sessions', (t) => {
      t.integer('version').notNullable().defaultTo(0);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasRuleId = await knex.schema.hasColumn('auction_sessions', 'rule_id');
  if (hasRuleId) {
    await knex.schema.alterTable('auction_sessions', (t) => {
      t.dropColumn('rule_id');
    });
  }

  const hasVersion = await knex.schema.hasColumn('auction_sessions', 'version');
  if (hasVersion) {
    await knex.schema.alterTable('auction_sessions', (t) => {
      t.dropColumn('version');
    });
  }
}
