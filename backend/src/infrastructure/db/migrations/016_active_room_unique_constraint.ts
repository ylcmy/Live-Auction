import { Knex } from 'knex';

/**
 * Migration: Add room_id index and clean up duplicate active sessions.
 *
 * Problem: auction_sessions has no index on room_id and no constraint
 * preventing multiple active sessions in the same room.
 *
 * Solution:
 * 1. Add index on (room_id, status) for fast active-session lookups
 * 2. Clean up existing duplicate active/pending sessions (keep the latest)
 * 3. Add a unique index on active_room_id (nullable column that is set
 *    only when status is 'active' or 'pending') to enforce the constraint
 *    at the database level.
 */
export async function up(knex: Knex): Promise<void> {
  // Step 1: Add active_room_id column (nullable)
  await knex.schema.alterTable('auction_sessions', (t) => {
    t.bigInteger('active_room_id').unsigned().nullable().comment('Set to room_id when status is active/pending; NULL otherwise. Used for unique constraint.');
  });

  // Step 2: Clean up duplicate active/pending sessions - keep only the latest per room
  const duplicates = await knex.raw(`
    SELECT room_id, GROUP_CONCAT(id ORDER BY id DESC) as session_ids
    FROM auction_sessions
    WHERE status IN ('pending', 'active')
    GROUP BY room_id
    HAVING COUNT(*) > 1
  `);

  for (const row of duplicates[0]) {
    const ids = row.session_ids.split(',').map(Number);
    const keepId = ids[0]; // latest
    const removeIds = ids.slice(1); // older ones

    // Set older sessions to 'ended' and clear their active_room_id
    await knex('auction_sessions')
      .whereIn('id', removeIds)
      .update({
        status: 'ended',
        ended_at: knex.fn.now(),
        active_room_id: null,
      });

    // Set the kept session's active_room_id
    await knex('auction_sessions')
      .where({ id: keepId })
      .update({ active_room_id: row.room_id });
  }

  // Step 3: Set active_room_id for remaining single active/pending sessions
  await knex.raw(`
    UPDATE auction_sessions
    SET active_room_id = room_id
    WHERE status IN ('pending', 'active') AND active_room_id IS NULL
  `);

  // Step 4: Add unique index on active_room_id
  // MySQL allows multiple NULL values in a unique index, so this effectively
  // enforces: at most one row with a non-NULL active_room_id value.
  await knex.raw(`
    CREATE UNIQUE INDEX idx_active_room_id ON auction_sessions (active_room_id)
  `);

  // Step 5: Add composite index for common query pattern
  await knex.raw(`
    CREATE INDEX idx_room_status ON auction_sessions (room_id, status)
  `);

  // Step 6: Also fix products that are 'active' but their session was ended
  await knex.raw(`
    UPDATE products p
    INNER JOIN auction_sessions s ON s.product_id = p.id
    SET p.status = 'ended'
    WHERE p.status = 'active' AND s.status IN ('ended', 'cancelled', 'unsold')
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('auction_sessions', (t) => {
    t.dropIndex('active_room_id');
    t.dropIndex(['room_id', 'status'], 'idx_room_status');
    t.dropColumn('active_room_id');
  });
}
