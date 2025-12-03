// Script to run Supabase migrations
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xzutldcwrlrfkzkqtjyn.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('Please set your Supabase service role key:');
  console.log('  export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration(filePath, fileName) {
  try {
    const sql = readFileSync(filePath, 'utf8');
    console.log(`\nRunning migration: ${fileName}`);
    
    // Split SQL by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (error) {
          // Try direct query if RPC doesn't work
          const { error: queryError } = await supabase.from('_migrations').select('*').limit(1);
          if (queryError) {
            // Use raw SQL execution via REST API
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
              },
              body: JSON.stringify({ sql_query: statement })
            });
            
            if (!response.ok) {
              console.error(`Error executing statement: ${statement.substring(0, 50)}...`);
              throw new Error(`Migration failed: ${response.statusText}`);
            }
          }
        }
      }
    }
    
    console.log(`✓ Migration ${fileName} completed successfully`);
  } catch (error) {
    console.error(`✗ Error running migration ${fileName}:`, error.message);
    throw error;
  }
}

async function main() {
  const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');
  const files = await readdir(migrationsDir);
  const migrationFiles = files
    .filter(f => f.endsWith('.sql'))
    .filter(f => f.startsWith('20250103')) // Only run our new migrations
    .sort();

  if (migrationFiles.length === 0) {
    console.log('No new migrations to run');
    return;
  }

  console.log(`Found ${migrationFiles.length} migration(s) to run:`);
  migrationFiles.forEach(f => console.log(`  - ${f}`));

  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file);
    await runMigration(filePath, file);
  }

  console.log('\n✓ All migrations completed successfully!');
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});



