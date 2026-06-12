import { db } from '../infrastructure/db/knex.js';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: 'merchant' | 'user' | 'admin';
  nickname: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export const userRepo = {
  async findByUsername(username: string): Promise<UserRow | undefined> {
    return db('users').where({ username }).first();
  },

  async create(data: {
    username: string;
    password_hash: string;
    role: 'merchant' | 'user' | 'admin';
    nickname: string;
  }): Promise<number> {
    const [id] = await db('users').insert(data);
    return id as number;
  },

  async findByIds(ids: number[]): Promise<Pick<UserRow, 'id' | 'nickname' | 'avatar_url'>[]> {
    if (ids.length === 0) return [];
    return db('users').whereIn('id', ids).select('id', 'nickname', 'avatar_url');
  },

  async findById(id: number): Promise<Omit<UserRow, 'password_hash'> | undefined> {
    return db('users').where({ id }).select('id', 'username', 'role', 'nickname', 'avatar_url', 'created_at', 'updated_at').first();
  },

  async updateProfile(id: number, data: { nickname: string }): Promise<Omit<UserRow, 'password_hash'> | undefined> {
    await db('users').where({ id }).update({ ...data, updated_at: db.fn.now() });
    return this.findById(id);
  },
};
