/**
 * Run Voice Enhancement v2.9 Migration
 *
 * Connects to Supabase PostgreSQL and executes the migration SQL.
 * Usage: node scripts/run-migration.js <database_password>
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const password = process.argv[2];

  if (!password) {
    console.log('Usage: node scripts/run-migration.js <database_password>');
    console.log('');
    console.log('Get your database password from:');
    console.log('https://supabase.com/dashboard/project/edaigbnnofyxcfbpcvct/settings/database');
    console.log('');
    console.log('Look for "Database password" in the Connection info section.');
    process.exit(1);
  }

  // Supabase connection string for edaigbnnofyxcfbpcvct
  const connectionString = `postgresql://postgres.edaigbnnofyxcfbpcvct:${password}@aws-0-us-east-2.pooler.supabase.com:6543/postgres`;

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase database...');
    await client.connect();
    console.log('Connected!');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251224130000_voice_enhancement_v29.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Running migration...');
    console.log('SQL file:', migrationPath);
    console.log('SQL length:', migrationSQL.length, 'characters');

    await client.query(migrationSQL);

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Tables created:');
    console.log('  - user_voice_settings');
    console.log('  - voice_usage');
    console.log('  - voice_clones');
    console.log('  - voice_personas');
    console.log('');
    console.log('Personas seeded: Maya, James, Tonya, System');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    if (error.message.includes('password authentication failed')) {
      console.error('Check your database password at:');
      console.error('https://supabase.com/dashboard/project/edaigbnnofyxcfbpcvct/settings/database');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
