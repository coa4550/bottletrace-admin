# Quick Start Guide

Get your Bottletrace Admin Portal up and running in 5 minutes!

## Prerequisites

✅ Node.js 18+ installed  
✅ A Supabase project created  
✅ Terminal/command line access

## Step 1: Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **Settings** → **API**
4. You'll need:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (under "Project API keys")
   - **service_role key** (under "Project API keys" - keep this secret!)

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Run the Setup Script

```bash
npm run setup
```

This interactive script will:
1. Create your `.env.local` file with Supabase credentials
2. Create your first admin user account

### What You'll Be Asked:

**Environment Setup:**
- Supabase URL
- Supabase Anon Key
- Supabase Service Role Key

**Admin Account:**
- Email address
- First name (optional)
- Last name (optional)
- Password (or auto-generate)

### Example Output:

```
🚀 Bottletrace Admin Portal - Initial Setup
================================================================================

📝 Step 1: Configure Environment Variables
================================================================================

🔑 Enter your Supabase credentials:
Supabase URL: https://myproject.supabase.co
Supabase Anon Key: eyJhbGc...
Supabase Service Role Key: eyJhbGc...

✅ .env.local created successfully!

👤 Step 2: Create Your First Admin Account
================================================================================

📋 Enter admin account details:
Email address: admin@example.com
First name: John
Last name: Doe
Password: (press Enter to auto-generate)

✅ ADMIN USER CREATED SUCCESSFULLY!

🔑 Login Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email: admin@example.com
Password: A9x$mK2p!vL7nQ3z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Save these credentials now!
```

## Step 4: Start the Development Server

```bash
npm run dev
```

## Step 5: Access the Portal

Open your browser and go to:
```
http://localhost:3000
```

Sign in with the email and password from Step 3!

## 🎉 You're All Set!

You can now:
- ✅ Create additional admin users
- ✅ Import brand and supplier data
- ✅ Manage relationships
- ✅ Review user submissions

## Troubleshooting

### "Cannot find module" error
Make sure you ran `npm install` first.

### "Missing SUPABASE env vars" error
The `.env.local` file wasn't created properly. Try:
```bash
npm run setup
```

### Can't sign in
Double-check your email and password. If you forgot the password, create a new admin:
```bash
npm run create-admin
```

### Database tables don't exist
You need to set up your Supabase database schema first. Check the migrations folder for SQL scripts.

## Next Steps

- 📖 Read the [README.md](./README.md) for full documentation
- 👤 Check [ADMIN_USER_SETUP.md](./ADMIN_USER_SETUP.md) for advanced user management
- 🚀 Deploy to Vercel (see README.md)

## Manual Setup (Alternative)

If you prefer to set up manually:

### 1. Create `.env.local`:
```bash
cp .env.example .env.local
```

### 2. Edit `.env.local` with your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Create admin user:
```bash
npm run create-admin
```

### 4. Start the server:
```bash
npm run dev
```

## Getting Help

- 📧 Check the troubleshooting sections in documentation
- 🐛 Open an issue on GitHub
- 📚 Review the comprehensive guides in the docs folder

---

**Ready to go? Run `npm run setup` now!** 🚀

