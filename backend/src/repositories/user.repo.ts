import { db } from '../infrastructure/db/knex.js';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: 'merchant' | 'user';
  nickname: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export const userRepo = {
  async findByUsername(username: string): Promise<UserRow | undefined> {
    return db('users').where({ username }).first();
  },

  async findById(id: number): Promise<UserRow | undefined> {
    return db('users').where({ id }).first();
  },

  async create(data: {
    username: string;
    password_hash: string;
    role: 'merchant' | 'user';
    nickname: string;
  }): Promise<number> {
    const [id] = await db('users').insert(data);
    return id;
  },
};
