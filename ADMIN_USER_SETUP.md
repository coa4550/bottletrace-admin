# Admin User Setup Guide

This guide explains how to create and manage admin user accounts for the Bottletrace Admin Portal.

## Overview

Admin users have full access to the admin portal and can:
- Approve/reject user submissions
- Manage brands, suppliers, and distributors
- Review and approve user reviews
- Import data via CSV
- Create and manage other admin users

## Method 1: Using the Admin Portal UI (Recommended)

### Prerequisites
- You must already have at least one admin account to access the portal
- Access to the admin portal at your deployment URL

### Steps

1. **Navigate to Users Page**
   - Log in to the admin portal
   - Click on "Users" in the navigation menu

2. **Create New Admin User**
   - Click the "+ Create Admin User" button in the top right
   - Fill in the required information:
     - **Email** (required): The email address for the new admin
     - **First Name**: Admin's first name
     - **Last Name**: Admin's last name
     - **Job Title**: Defaults to "Admin"
     - **Employer**: Company or organization name
     - **Location**: City, State or region

3. **Submit and Share Credentials**
   - Click "Create User"
   - A success message will appear with a magic link
   - Copy the magic link and send it to the new admin
   - The admin can use this link to sign in for the first time

### Features
- Email is auto-confirmed (no verification email needed)
- Magic link authentication for first login
- User profile is automatically created
- Email column shows in the users table

## Method 2: Using the CLI Script

For situations where you need to create the first admin user or don't have access to the UI:

### Prerequisites
- Node.js installed
- Access to the `.env` file with Supabase credentials
- Terminal/command line access

### Steps

1. **Navigate to the project directory**
   ```bash
   cd /path/to/bottletrace-admin-bulk
   ```

2. **Run the create admin script**
   ```bash
   node scripts/create-admin.js
   ```

3. **Follow the prompts**
   - Enter the email address
   - Enter first name (optional)
   - Enter last name (optional)
   - Enter job title (default: "Admin")

4. **Copy the magic link**
   - The script will output a magic link
   - Send this link to the new admin user
   - They can use it to sign in

## Method 3: Direct Database Access (Advanced)

Only use this method if absolutely necessary (e.g., locked out of the system).

### Using Supabase Dashboard

1. **Create Auth User**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User"
   - Enter email address
   - Enable "Auto Confirm User"
   - Copy the user ID (UUID)

2. **Create User Profile**
   - Go to Table Editor → user_profiles
   - Click "Insert Row"
   - Fill in:
     - `user_id`: Paste the UUID from step 1
     - `first_name`: First name
     - `last_name`: Last name
     - `job_title`: "Admin"
     - Other fields as needed
   - Save

3. **Generate Magic Link**
   - Go back to Authentication → Users
   - Find the user you created
   - Click the three dots menu → "Send Magic Link"
   - Send the link to the user

## User Management

### Viewing Users
- Navigate to the Users page in the admin portal
- Search by email, name, job title, employer, or location
- Sort by any column
- View submission and review counts

### Deleting Users
- Click the "Delete" button next to a user
- Click again to confirm deletion
- This removes both the auth user and profile

## Security Considerations

1. **Email-based Authentication**
   - Admin users authenticate via magic links sent to their email
   - Ensure email addresses are valid and secure
   - Users can set up passwords through the Supabase auth flow

2. **Access Control**
   - All admin users currently have equal permissions
   - Consider implementing role-based access control (RBAC) for granular permissions

3. **Magic Links**
   - Magic links are single-use and expire
   - Always use secure channels to share magic links
   - Links should only be shared directly with the intended user

## Troubleshooting

### "Failed to create user" Error
- **Cause**: Email already exists in the system
- **Solution**: Check if the user already exists or use a different email

### "Missing SUPABASE env vars" Error
- **Cause**: Environment variables not set
- **Solution**: Ensure `.env` file contains:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### User created but can't sign in
- **Cause**: Email not confirmed or profile not created
- **Solution**: 
  - Check Supabase Dashboard → Authentication → Users
  - Verify email is confirmed
  - Check user_profiles table for profile record
  - Regenerate magic link if needed

### API returns 500 error
- **Cause**: Database connection issue or missing permissions
- **Solution**:
  - Check Supabase service role key
  - Verify database tables exist
  - Check server logs for detailed error messages

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## API Endpoints

The following API endpoints are available for user management:

### Create User
```http
POST /api/users
Content-Type: application/json

{
  "email": "admin@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "jobTitle": "Admin",
  "employer": "Company Name",
  "location": "City, State"
}
```

### List Users
```http
GET /api/users
```

### Delete User
```http
DELETE /api/users?userId={uuid}
```

## Best Practices

1. **Use descriptive job titles** to identify admin roles and responsibilities
2. **Document admin access** - keep a record of who has admin access
3. **Regular audits** - periodically review admin user list
4. **Immediate revocation** - delete admin access when no longer needed
5. **Secure magic links** - use encrypted channels to share authentication links
6. **Monitor activity** - track submission and review activity by admin users

## Future Enhancements

Potential improvements to the admin user system:

- [ ] Role-based access control (RBAC)
- [ ] Password reset functionality
- [ ] Two-factor authentication (2FA)
- [ ] Audit logging for admin actions
- [ ] Email templates for welcome messages
- [ ] Bulk user import
- [ ] User suspension/deactivation
- [ ] Permission groups and teams

