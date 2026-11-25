import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const isDatabaseConfigured = Boolean(
  process.env.SQL_HOST &&
    process.env.SQL_DB_NAME &&
    process.env.SQL_USER &&
    process.env.SQL_PASSWORD,
);

function buildPoolConfig(): PoolConfig | null {
  if (!isDatabaseConfigured) return null;

  const useSsl = process.env.SQL_SSL === 'true';

  return {
    host: process.env.SQL_HOST,
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

let db: ReturnType<typeof drizzle<typeof schema>>;
try {
  const pool = createPool();
  if (!pool) {
    throw new Error('SQL environment variables not configured');
  }
  db = drizzle(pool, { schema });
} catch {
  console.warn('[Server] Cloud SQL not configured — using in-memory store');
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
