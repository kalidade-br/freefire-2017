import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;
const useSsl = process.env.SQL_SSL === 'true';

if (!databaseUrl && (!sqlHost || !sqlDbName || !user || !password)) {
  throw new Error(
    'Set either DATABASE_URL or SQL_HOST, SQL_DB_NAME, SQL_USER, SQL_PASSWORD in environment variables.',
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: databaseUrl
    ? {
        url: databaseUrl,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      }
    : {
        host: sqlHost!,
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
        user: user!,
        password: password!,
        database: sqlDbName!,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
      },
  verbose: true,
});
