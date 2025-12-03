// Direct migration runner using Supabase credentials
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://xzutldcwrlrfkzkqtjyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dXRsZGN3cmxyZmt6a3F0anluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mjg3MDUsImV4cCI6MjA3OTIwNDcwNX0.mRSVdOGhkqC-Gz1teYKWYDUDqjKZYca66rSkV-oW3fk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const migrations = `
-- Migration 1: Add Apify API Key to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS apify_api_key text;

COMMENT ON COLUMN public.profiles.apify_api_key IS 'User-specific Apify API key. If null, uses default key.';

-- Migration 2: Add Archived Field to Reels
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

COMMENT ON COLUMN public.reels.is_archived IS 'Marks reels that are archived/restricted (e.g., restricted_page error from Apify). All counts are set to 0 for archived reels.';

-- Create index for faster queries on archived reels
CREATE INDEX IF NOT EXISTS idx_reels_is_archived ON public.reels(is_archived);
`;

async function runMigrations() {
  console.log('🔄 Attempting to run migrations...\n');
  
  // Split SQL into individual statements
  const statements = migrations
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.includes('COMMENT'));

  for (const statement of statements) {
    if (statement.trim()) {
      console.log(`Executing: ${statement.substring(0, 60)}...`);
      
      try {
        // Try using RPC call (if available)
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: statement 
        });
        
        if (error) {
          // Try direct REST API call
          const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ sql: statement })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Error: ${errorText}`);
            throw new Error(`Migration failed: ${response.statusText}`);
          }
        }
        
        console.log('✓ Success\n');
      } catch (error) {
        console.error(`❌ Error: ${error.message}\n`);
        console.log('\n⚠️  Note: The anon key may not have permissions to alter table schemas.');
        console.log('📝 Please run these migrations in the Supabase Dashboard SQL Editor instead:');
        console.log('   1. Go to https://supabase.com/dashboard');
        console.log('   2. Select your project');
        console.log('   3. Go to SQL Editor > New Query');
        console.log('   4. Copy the SQL from: supabase/migrations/run_all_new_migrations.sql');
        console.log('   5. Click Run\n');
        process.exit(1);
      }
    }
  }
  
  console.log('✅ All migrations completed successfully!');
}

runMigrations().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});



