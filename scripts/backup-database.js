const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase connection details
const url = 'https://pgycxpmqnrjsusgoinxz.supabase.co';
// You'll need to provide your service role key
// Check in Supabase Dashboard > Settings > API > service_role key
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2];

if (!serviceKey) {
  console.error('Error: Missing service role key');
  console.log('Usage: node scripts/backup-database.js <service_role_key>');
  console.log('Or set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false }
});

// List of all known tables - update this if you have more
const tables = [
  'brands',
  'categories',
  'sub_categories',
  'brand_categories',
  'brand_sub_categories',
  'core_brand_distributor',
  'core_brand_supplier',
  'core_distributor_supplier_state',
  'core_suppliers',
  'core_states',
  'users',
  'submissions',
  'audit_logs',
  'core_distributors'
];

async function backupTable(tableName) {
  console.log(`Backing up ${tableName}...`);
  const { data, error } = await supabase
    .from(tableName)
    .select('*');
  
  if (error) {
    console.error(`Error backing up ${tableName}:`, error.message);
    return null;
  }
  
  return data;
}

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const backupFile = path.join(__dirname, '..', 'migrations', `backup_${timestamp}.json`);
  
  console.log('Starting backup...');
  const backup = {
    timestamp: new Date().toISOString(),
    tables: {}
  };
  
  for (const table of tables) {
    const data = await backupTable(table);
    if (data !== null) {
      backup.tables[table] = data;
      console.log(`✓ Backed up ${table}: ${data.length} rows`);
    }
  }
  
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Backup complete: ${backupFile}`);
  console.log(`Total size: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB`);
}

createBackup().catch(console.error);
