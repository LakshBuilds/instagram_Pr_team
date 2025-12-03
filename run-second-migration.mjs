// Run the second migration (is_archived column)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xzutldcwrlrfkzkqtjyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dXRsZGN3cmxyZmt6a3F0anluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mjg3MDUsImV4cCI6MjA3OTIwNDcwNX0.mRSVdOGhkqC-Gz1teYKWYDUDqjKZYca66rSkV-oW3fk';

async function runSecondMigration() {
  console.log('🔄 Running second migration (is_archived column)...\n');
  
  const sql = `
    ALTER TABLE public.reels 
    ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
    
    CREATE INDEX IF NOT EXISTS idx_reels_is_archived ON public.reels(is_archived);
  `;
  
  try {
    // Try using Supabase REST API SQL execution endpoint
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ query: sql })
    });
    
    if (response.ok) {
      console.log('✅ Migration executed successfully!\n');
    } else {
      const errorText = await response.text();
      console.log('⚠️  Direct execution not available with anon key.');
      console.log('\n📝 Please run this SQL in Supabase Dashboard:');
      console.log('─'.repeat(60));
      console.log('ALTER TABLE public.reels');
      console.log('ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;');
      console.log('');
      console.log('CREATE INDEX IF NOT EXISTS idx_reels_is_archived ON public.reels(is_archived);');
      console.log('─'.repeat(60));
      console.log('\nSteps:');
      console.log('1. Go to https://supabase.com/dashboard');
      console.log('2. Select your project');
      console.log('3. Go to SQL Editor > New Query');
      console.log('4. Paste the SQL above');
      console.log('5. Click Run\n');
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n📝 Please run the SQL manually in Supabase Dashboard (see above)\n');
  }
}

runSecondMigration();



