import { db } from '../knex.js';
import bcrypt from 'bcrypt';
import { env } from '../../../config/env.js';

export async function seed(): Promise<void> {
  const hash = await bcrypt.hash('pass1234', env.BCRYPT_COST);
  const now = new Date();

  await db('users').insert([
    { username: 'merchant_1', password_hash: hash, role: 'merchant', nickname: '李老板', created_at: now, updated_at: now },
    { username: 'user_1', password_hash: hash, role: 'user', nickname: '竞拍达人小王', created_at: now, updated_at: now },
    { username: 'user_2', password_hash: hash, role: 'user', nickname: '捡漏专家小李', created_at: now, updated_at: now },
  ]);

  // Also create a sample product, room for easy testing
  await db('products').insert({
    merchant_id: 1, name: '限量版球鞋', description: '全新未拆封限量版AJ球鞋', image_url: 'https://picsum.photos/400/400', category: '鞋类', status: 'pending', created_at: now, updated_at: now,
  });
  await db('auction_rules').insert({
    product_id: 1, start_price: 0.00, bid_increment: 10.00, ceiling_price: 500.00, duration_seconds: 60, extend_seconds: 20, max_extensions: 10, created_at: now, updated_at: now,
  });
  await db('live_rooms').insert({
    host_id: 1, title: '李老板的竞拍直播间', status: 'offline', stream_url: null, created_at: now,
  });

  console.log('Seed data inserted.');
  await db.destroy();
}

seed().catch((err) => { console.error(err); process.exit(1); });
