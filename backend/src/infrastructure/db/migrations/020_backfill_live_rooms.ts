import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Find all approved merchant applications whose user doesn't have a live room yet
  const approvedApps = await knex('merchant_applications as ma')
    .join('users as u', 'ma.user_id', 'u.id')
    .where('ma.status', 'approved')
    .where('u.role', 'merchant')
    .whereNotExists(function () {
      this.select('*').from('live_rooms').whereRaw('live_rooms.host_id = ma.user_id');
    }) 
    .select('ma.user_id', 'ma.shop_name');

  if (approvedApps.length === 0) return;

  const now = new Date();
  const rows = approvedApps.map((app: { user_id: number; shop_name: string }) => ({
    host_id: app.user_id,
    title: app.shop_name,
    status: 'offline',
    created_at: now,
    updated_at: now,
  }));

  await knex('live_rooms').insert(rows);
}

export async function down(knex: Knex): Promise<void> {
  // Remove backfilled rooms - since we can't distinguish backfilled from manually created,
  // this is a no-op. The rooms are safe to keep — they only exist for approved merchants.
}
