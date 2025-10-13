#!/usr/bin/env node

/**
 * CLI Script to Create Admin Users
 * 
 * This script creates admin users for the Bottletrace Admin Portal.
 * Use this when you need to create the first admin user or when you
 * don't have access to the admin UI.
 * 
 * Usage:
 *   node scripts/create-admin.js
 * 
 * Or with arguments:
 *   node scripts/create-admin.js --email admin@example.com --firstName John --lastName Doe
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Load environment variables from .env file
require('dotenv').config();

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

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    parsed[key] = value;
  }
  
  return parsed;
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

async function createAdminUser(userData) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    log('❌ Error: Missing Supabase environment variables', 'red');
    log('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file', 'yellow');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false }
  });

  try {
    log('\n📝 Creating admin user...', 'cyan');

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      email_confirm: true,
      user_metadata: {
        first_name: userData.firstName,
        last_name: userData.lastName,
        role: 'admin'
      }
    });

    if (authError) {
      log(`❌ Failed to create auth user: ${authError.message}`, 'red');
      process.exit(1);
    }

    log(`✅ Auth user created with ID: ${authData.user.id}`, 'green');

    // Create user profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        first_name: userData.firstName || null,
        last_name: userData.lastName || null,
        job_title: userData.jobTitle || 'Admin',
        employer: userData.employer || null,
        location: userData.location || null
      })
      .select()
      .single();

    if (profileError) {
      log(`❌ Failed to create user profile: ${profileError.message}`, 'red');
      log('Rolling back auth user creation...', 'yellow');
      
      await supabase.auth.admin.deleteUser(authData.user.id);
      log('Auth user deleted', 'yellow');
      process.exit(1);
    }

    log('✅ User profile created', 'green');

    // Generate magic link
    const { data: magicLinkData, error: magicLinkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.email
    });

    if (magicLinkError) {
      log(`⚠️  Warning: Could not generate magic link: ${magicLinkError.message}`, 'yellow');
    }

    // Display success message
    log('\n' + '='.repeat(80), 'green');
    log('✅ ADMIN USER CREATED SUCCESSFULLY!', 'green');
    log('='.repeat(80), 'green');
    log(`\nEmail: ${authData.user.email}`, 'bright');
    log(`User ID: ${authData.user.id}`, 'bright');
    log(`Name: ${userData.firstName || 'N/A'} ${userData.lastName || 'N/A'}`, 'bright');
    log(`Job Title: ${userData.jobTitle || 'Admin'}`, 'bright');

    if (magicLinkData?.properties?.action_link) {
      log('\n📧 Magic Link for First Sign-In:', 'cyan');
      log(magicLinkData.properties.action_link, 'blue');
      log('\n📋 Send this link to the user to allow them to sign in.', 'yellow');
    } else {
      log('\n📧 You can generate a sign-in link from the Supabase dashboard:', 'yellow');
      log('Authentication → Users → Select User → Send Magic Link', 'yellow');
    }

    log('\n' + '='.repeat(80) + '\n', 'green');

    return {
      success: true,
      user: authData.user,
      profile: profileData,
      magicLink: magicLinkData?.properties?.action_link
    };

  } catch (error) {
    log(`❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  log('\n' + '='.repeat(80), 'cyan');
  log('🔧 Bottletrace Admin User Creation Tool', 'bright');
  log('='.repeat(80) + '\n', 'cyan');

  const args = parseArgs();
  const userData = {};

  // Get email
  if (args.email) {
    userData.email = args.email;
  } else {
    userData.email = await prompt('Enter email address (required): ');
  }

  if (!userData.email || !userData.email.includes('@')) {
    log('❌ Invalid email address', 'red');
    process.exit(1);
  }

  // Get first name
  if (args.firstName) {
    userData.firstName = args.firstName;
  } else {
    userData.firstName = await prompt('Enter first name (optional): ');
  }

  // Get last name
  if (args.lastName) {
    userData.lastName = args.lastName;
  } else {
    userData.lastName = await prompt('Enter last name (optional): ');
  }

  // Get job title
  if (args.jobTitle) {
    userData.jobTitle = args.jobTitle;
  } else {
    const jobTitle = await prompt('Enter job title (default: Admin): ');
    userData.jobTitle = jobTitle || 'Admin';
  }

  // Get employer
  if (args.employer) {
    userData.employer = args.employer;
  } else {
    userData.employer = await prompt('Enter employer (optional): ');
  }

  // Get location
  if (args.location) {
    userData.location = args.location;
  } else {
    userData.location = await prompt('Enter location (optional): ');
  }

  // Confirm
  log('\n📋 Review User Information:', 'cyan');
  log(`  Email: ${userData.email}`, 'bright');
  log(`  Name: ${userData.firstName || 'N/A'} ${userData.lastName || 'N/A'}`, 'bright');
  log(`  Job Title: ${userData.jobTitle}`, 'bright');
  log(`  Employer: ${userData.employer || 'N/A'}`, 'bright');
  log(`  Location: ${userData.location || 'N/A'}`, 'bright');

  const confirm = await prompt('\nCreate this admin user? (y/n): ');
  
  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    log('❌ Cancelled', 'yellow');
    process.exit(0);
  }

  await createAdminUser(userData);
}

// Run the script
main().catch((error) => {
  log(`❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

