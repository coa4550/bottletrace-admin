#!/usr/bin/env node

/**
 * Initial Setup Script
 * 
 * This script helps you set up the Bottletrace Admin Portal for the first time:
 * 1. Creates .env.local file with your Supabase credentials
 * 2. Creates your first admin user account
 * 
 * Usage:
 *   node scripts/initial-setup.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function createEnvFile() {
  log('\n' + '='.repeat(80), 'cyan');
  log('📝 Step 1: Configure Environment Variables', 'bright');
  log('='.repeat(80), 'cyan');
  
  const envPath = path.join(__dirname, '..', '.env.local');
  
  if (fs.existsSync(envPath)) {
    log('\n⚠️  .env.local already exists!', 'yellow');
    const overwrite = await prompt('Do you want to overwrite it? (y/n): ');
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      log('✅ Keeping existing .env.local', 'green');
      return true;
    }
  }

  log('\n🔑 Enter your Supabase credentials:', 'cyan');
  log('   (You can find these in your Supabase project dashboard)', 'yellow');
  log('   Settings → API\n', 'yellow');

  const supabaseUrl = await prompt('Supabase URL (e.g., https://xxxxx.supabase.co): ');
  if (!supabaseUrl || !supabaseUrl.includes('supabase')) {
    log('❌ Invalid Supabase URL', 'red');
    return false;
  }

  const anonKey = await prompt('Supabase Anon Key: ');
  if (!anonKey || anonKey.length < 20) {
    log('❌ Invalid Anon Key', 'red');
    return false;
  }

  const serviceKey = await prompt('Supabase Service Role Key: ');
  if (!serviceKey || serviceKey.length < 20) {
    log('❌ Invalid Service Role Key', 'red');
    return false;
  }

  const envContent = `# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceKey}

# Legacy admin credentials (kept for backwards compatibility)
ADMIN_USER=admin
ADMIN_PASS=change-me

# Table names
TABLE_BRANDS=core_brands
TABLE_SUPPLIERS=core_suppliers
TABLE_STATES=core_states
TABLE_BRAND_SUPPLIER_STATES=brand_supplier_states
`;

  try {
    fs.writeFileSync(envPath, envContent);
    log('\n✅ .env.local created successfully!', 'green');
    return true;
  } catch (error) {
    log(`\n❌ Failed to create .env.local: ${error.message}`, 'red');
    return false;
  }
}

async function createFirstAdmin() {
  log('\n' + '='.repeat(80), 'cyan');
  log('👤 Step 2: Create Your First Admin Account', 'bright');
  log('='.repeat(80), 'cyan');

  const createNow = await prompt('\nCreate admin account now? (y/n): ');
  if (createNow.toLowerCase() !== 'y' && createNow.toLowerCase() !== 'yes') {
    log('\n💡 You can create an admin later by running:', 'yellow');
    log('   npm run create-admin\n', 'blue');
    return;
  }

  log('\n📋 Enter admin account details:', 'cyan');

  const email = await prompt('Email address: ');
  if (!email || !email.includes('@')) {
    log('❌ Invalid email address', 'red');
    return;
  }

  const firstName = await prompt('First name (optional): ');
  const lastName = await prompt('Last name (optional): ');
  const password = await prompt('Password (or press Enter to auto-generate): ');

  // Load the create-admin script
  log('\n📝 Creating admin account...', 'cyan');
  
  // Set process.argv to simulate command-line arguments
  process.argv = [
    process.argv[0],
    path.join(__dirname, 'create-admin.js'),
    '--email', email
  ];

  if (firstName) {
    process.argv.push('--firstName', firstName);
  }
  if (lastName) {
    process.argv.push('--lastName', lastName);
  }
  if (password) {
    process.argv.push('--password', password);
  }

  // Clear require cache and require the create-admin script
  delete require.cache[require.resolve('./create-admin.js')];
  
  try {
    require('./create-admin.js');
  } catch (error) {
    log(`\n❌ Failed to create admin: ${error.message}`, 'red');
    log('\n💡 You can try again by running:', 'yellow');
    log('   npm run create-admin\n', 'blue');
  }
}

async function main() {
  log('\n' + '='.repeat(80), 'green');
  log('🚀 Bottletrace Admin Portal - Initial Setup', 'bright');
  log('='.repeat(80), 'green');
  log('\nThis script will help you set up the admin portal for the first time.\n', 'cyan');

  // Step 1: Create .env.local
  const envCreated = await createEnvFile();
  if (!envCreated) {
    log('\n❌ Setup failed. Please try again.', 'red');
    process.exit(1);
  }

  // Step 2: Create first admin (optional)
  await createFirstAdmin();

  log('\n' + '='.repeat(80), 'green');
  log('✅ Setup Complete!', 'bright');
  log('='.repeat(80), 'green');
  log('\n📚 Next steps:', 'cyan');
  log('   1. Start the development server: npm run dev', 'blue');
  log('   2. Open http://localhost:3000 in your browser', 'blue');
  log('   3. Sign in with your admin credentials', 'blue');
  log('\n💡 Need help? Check the README.md and ADMIN_USER_SETUP.md\n', 'yellow');
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

