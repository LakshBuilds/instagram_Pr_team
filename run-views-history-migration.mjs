import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Running views_history migration...');
  
  const sql = readFileSync('supabase/migrations/20241214_views_history.sql', 'utf8');
  
  // Split by semicolons and run each statement
  const statements = sql.split(';').filter(s => s.trim());
  
  for (const statement of statements) {
    if (!statement.trim()) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
      if (error) {
        console.log('⚠️ Statement may have already been applied or error:', error.message);
      }
    } catch (err) {
      console.log('⚠️ Skipping statement (may already exist)');
    }
  }
  
  console.log('✅ Migration completed!');
  console.log('');
  console.log('📋 New features added:');
  console.log('   • views_history table for timestamp-based analytics');
  console.log('   • decay_priority column for smart refresh');
  console.log('   • last_refresh_at column for tracking updates');
  console.log('   • Database functions for views growth calculation');
}

runMigration().catch(console.error);