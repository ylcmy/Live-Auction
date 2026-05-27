import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const duplicates = await knex('live_rooms')
    .select('host_id')
    .groupBy('host_id')
    .havingRaw('COUNT(*) > 1');

  for (const dup of duplicates) {
    const rooms = await knex('live_rooms')
      .where({ host_id: dup.host_id })
      .orderBy('created_at', 'desc');

    const keepId = rooms[0].id;
    const removeIds = rooms.slice(1).map((r: any) => r.id);

    const activeSessions = await knex('auction_sessions')
      .whereIn('room_id', removeIds)
      .whereIn('status', ['pending', 'active']);

    if (activeSessions.length > 0) {
      await knex('auction_sessions')
        .whereIn('room_id', removeIds)
        .whereIn('status', ['pending', 'active'])
        .update({ room_id: keepId });
    }

    await knex('auction_sessions')
      .whereIn('room_id', removeIds)
      .update({ room_id: keepId });

    await knex('live_rooms').whereIn('id', removeIds).del();
  }

  await knex.schema.alterTable('live_rooms', (t) => {
    t.unique('host_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('live_rooms', (t) => {
    t.dropUnique('host_id');
  });
}
