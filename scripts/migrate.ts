import postgres from 'postgres';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const projectRef = 'kdjpsimoskqgxlvynnkz';
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
const dbPassword = process.env.SUPABASE_DB_PASSWORD || '';

async function runMigration() {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf-8');

  let connectionString = dbUrl;
  if (!connectionString && dbPassword) {
    connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;
  }

  if (connectionString) {
    console.log('📡 Connecting directly to Supabase PostgreSQL database...');
    try {
      const sqlClient = postgres(connectionString, { ssl: 'require' });
      await sqlClient.unsafe(sql);
      console.log('✅ All 7 tables, indexes, and initial usage seed applied successfully to Supabase!');
      await sqlClient.end();
      process.exit(0);
    } catch (err: any) {
      console.error('❌ PostgreSQL Migration failed:', err.message);
      process.exit(1);
    }
  }

  console.log('ℹ️  PostgreSQL requires a direct connection to run DDL (CREATE TABLE).');
  console.log('👉 Provide DATABASE_URL or SUPABASE_DB_PASSWORD in .env, or paste it here to run automatically.');
}

runMigration();
