/**
 * Apply Voice Enhancement v2.9 Database Migration
 * This script applies the migration SQL directly to Supabase
 */

const fs = require('fs');
const path = require('path');

// Read migration file
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251224130000_voice_enhancement_v29.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

// Supabase connection details from environment or hardcoded for this project
const SUPABASE_URL = 'https://edaigbnnofyxcfbpcvct.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function applyMigration() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    console.log('Set it with: set SUPABASE_SERVICE_ROLE_KEY=your_key_here');
    process.exit(1);
  }

  console.log('Applying Voice Enhancement v2.9 Migration...');
  console.log('Migration file:', migrationPath);
  console.log('SQL length:', migrationSQL.length, 'characters');

  try {
    // Use the Supabase REST API to execute SQL
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sql: migrationSQL }),
    });

    if (!response.ok) {
      // If the RPC function doesn't exist, we need a different approach
      console.log('RPC method not available, trying alternative approach...');

      // Split the SQL into individual statements and run them via pg_query
      // This won't work via REST API, so we'll output instructions instead
      console.log('\n============================================');
      console.log('MANUAL STEP REQUIRED');
      console.log('============================================');
      console.log('Please copy the SQL from:');
      console.log(migrationPath);
      console.log('\nAnd run it in the Supabase SQL Editor at:');
      console.log('https://supabase.com/dashboard/project/edaigbnnofyxcfbpcvct/sql/new');
      console.log('============================================\n');
      process.exit(1);
    }

    const result = await response.json();
    console.log('Migration applied successfully!');
    console.log('Result:', result);
  } catch (error) {
    console.error('Error applying migration:', error.message);
    console.log('\n============================================');
    console.log('MANUAL STEP REQUIRED');
    console.log('============================================');
    console.log('Please copy the SQL from:');
    console.log(migrationPath);
    console.log('\nAnd run it in the Supabase SQL Editor at:');
    console.log('https://supabase.com/dashboard/project/edaigbnnofyxcfbpcvct/sql/new');
    console.log('============================================\n');
    process.exit(1);
  }
}

applyMigration();
