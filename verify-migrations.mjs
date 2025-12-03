// Verify migrations were applied
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xzutldcwrlrfkzkqtjyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dXRsZGN3cmxyZmt6a3F0anluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mjg3MDUsImV4cCI6MjA3OTIwNDcwNX0.mRSVdOGhkqC-Gz1teYKWYDUDqjKZYca66rSkV-oW3fk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyMigrations() {
  console.log('🔍 Verifying migrations...\n');
  
  try {
    // Try to query the new columns
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('apify_api_key')
      .limit(1);
    
    if (profilesError && profilesError.message.includes('column') && profilesError.message.includes('apify_api_key')) {
      console.log('❌ Migration 1 FAILED: apify_api_key column not found');
      console.log('   Error:', profilesError.message);
    } else {
      console.log('✅ Migration 1 SUCCESS: apify_api_key column exists');
    }
    
    const { data: reels, error: reelsError } = await supabase
      .from('reels')
      .select('is_archived')
      .limit(1);
    
    if (reelsError && reelsError.message.includes('column') && reelsError.message.includes('is_archived')) {
      console.log('❌ Migration 2 FAILED: is_archived column not found');
      console.log('   Error:', reelsError.message);
    } else {
      console.log('✅ Migration 2 SUCCESS: is_archived column exists');
    }
    
    console.log('\n📝 If migrations failed, please run the SQL manually in Supabase Dashboard:');
    console.log('   File: supabase/migrations/run_all_new_migrations.sql\n');
    
  } catch (error) {
    console.error('Error verifying migrations:', error.message);
  }
}

verifyMigrations();



