// Simple migration runner for Supabase
// Usage: node run-migrations.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get Supabase credentials from environment or .env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xzutldcwrlrfkzkqtjyn.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ Error: VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SERVICE_ROLE_KEY required');
  console.log('\n📝 To run migrations, you have two options:');
  console.log('\nOption 1: Run in Supabase Dashboard (Recommended)');
  console.log('  1. Go to https://supabase.com/dashboard');
  console.log('  2. Select your project');
  console.log('  3. Go to SQL Editor');
  console.log('  4. Copy and paste the contents of: supabase/migrations/run_all_new_migrations.sql');
  console.log('  5. Click "Run"');
  console.log('\nOption 2: Use Supabase CLI');
  console.log('  1. Install: npm install -g supabase');
  console.log('  2. Login: supabase login');
  console.log('  3. Link: supabase link --project-ref ijyxkaamhxyuqmfvlics');
  console.log('  4. Run: supabase db push');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runSQL(sql) {
  // Try to execute via RPC if available, otherwise show instructions
  console.log('⚠️  Direct SQL execution requires service role key.');
  console.log('📝 Please run migrations via Supabase Dashboard SQL Editor instead.');
  console.log('\nSQL to run:');
  console.log('─'.repeat(50));
  console.log(sql);
  console.log('─'.repeat(50));
}

async function main() {
  const migrationsDir = join(__dirname, 'supabase', 'migrations');
  const combinedFile = join(migrationsDir, 'run_all_new_migrations.sql');
  
  try {
    const sql = readFileSync(combinedFile, 'utf8');
    console.log('📦 Found combined migration file\n');
    await runSQL(sql);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();



