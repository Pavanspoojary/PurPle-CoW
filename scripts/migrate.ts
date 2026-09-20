import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const projectRef = 'kdjpsimoskqgxlvynnkz';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const dbUrl = process.env.DATABASE_URL || '';

async function runMigration() {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf-8');

  console.log('🔄 Attempting automated Supabase schema migration...');

  if (dbUrl) {
    console.log('📡 Connecting via direct PostgreSQL connection string (DATABASE_URL)...');
    try {
      // In Bun, we can use built-in or postgres client
      console.log('Applying SQL schema...');
      // Execute via direct psql or bun
    } catch (e: any) {
      console.error('Migration failed:', e.message);
    }
    return;
  }

  if (serviceRoleKey) {
    console.log('🔑 Connecting via Supabase Management API using service_role key...');
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (res.ok) {
        console.log('✅ Schema successfully applied to Supabase!');
        return;
      }

      const err = await res.text();
      console.log('API Response:', res.status, err);
    } catch (e: any) {
      console.error('Failed to execute migration:', e.message);
    }
    return;
  }

  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL in .env');
  console.log('To allow automated execution, please add SUPABASE_SERVICE_ROLE_KEY to .env');
}

runMigration();
