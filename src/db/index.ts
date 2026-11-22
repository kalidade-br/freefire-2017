import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _postgresSchemaReady: Promise<void> | undefined;
}

const instanceConnName =
  process.env.INSTANCE_CONNECTION_NAME ||
  process.env.CLOUD_SQL_CONNECTION_NAME ||
  '';

const resolvedHost =
  process.env.SQL_HOST ||
  (instanceConnName ? `/cloudsql/${instanceConnName}` : '');

export const isDatabaseConfigured = Boolean(
  process.env.DATABASE_URL ||
    (resolvedHost &&
      process.env.SQL_DB_NAME &&
      process.env.SQL_USER &&
      process.env.SQL_PASSWORD),
);

function buildPoolConfig(): PoolConfig | null {
  if (!isDatabaseConfigured) return null;

  const useSsl =
    process.env.SQL_SSL === 'true' ||
    Boolean(process.env.DATABASE_URL?.includes('sslmode=require'));

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 15000,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };
  }

  return {
    host: resolvedHost,
    port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    max: 10,
    connectionTimeoutMillis: 15000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

export const createPool = (): Pool | null => {
  const cfg = buildPoolConfig();
  if (!cfg) return null;
  if (!global._postgresPool) {
    global._postgresPool = new Pool(cfg);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export async function ensureDatabaseSchema(): Promise<void> {
  if (!isDatabaseConfigured) return;
  const pool = createPool();
  if (!pool) return;
  if (!global._postgresSchemaReady) {
    global._postgresSchemaReady = (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS accounts (
            id SERIAL PRIMARY KEY,
            public_id TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            firebase_uid TEXT,
            nickname TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 1,
            gold INTEGER NOT NULL DEFAULT 1200,
            gems INTEGER NOT NULL DEFAULT 40,
            matches_played INTEGER NOT NULL DEFAULT 0,
            wins INTEGER NOT NULL DEFAULT 0,
            rank_points INTEGER NOT NULL DEFAULT 1000,
            ranked_matches INTEGER NOT NULL DEFAULT 0,
            ranked_wins INTEGER NOT NULL DEFAULT 0,
            total_kills INTEGER NOT NULL DEFAULT 0,
            character_json TEXT NOT NULL DEFAULT '{}',
            last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS friendships (
            id SERIAL PRIMARY KEY,
            requester_id INTEGER NOT NULL REFERENCES accounts(id),
            addressee_id INTEGER NOT NULL REFERENCES accounts(id),
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `);
      } catch (err) {
        global._postgresSchemaReady = undefined;
        console.warn('Database schema initialization warning:', err);
      }
    })();
  }
  return global._postgresSchemaReady;
}

let db: ReturnType<typeof drizzle<typeof schema>>;
try {
  const pool = createPool();
  if (!pool) {
    throw new Error('SQL environment variables not configured');
  }
  db = drizzle(pool, { schema });
} catch {
  console.warn('[Server] PostgreSQL not configured — using in-memory store');
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d?: { data?: unknown }) => d?.data ?? {},
    update: async (d?: { data?: unknown }) => d?.data ?? {},
    delete: async () => ({}),
  };
  db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
    get: (_target, prop) =>
      prop === 'query'
        ? new Proxy({}, { get: () => noOp })
        : async () => [],
  });
}

export { db };
