import knex from 'knex';
import { env } from '../../config/env.js';

const knexConfig = {
  client: 'mysql2',
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  },
  pool: { min: 2, max: 20 },
  migrations: { tableName: 'knex_migrations', directory: './migrations' },
};

export default knexConfig;

export const db = knex(knexConfig);
