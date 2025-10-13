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
     - **Password**: Choose to auto-generate or create a custom password
     - **First Name**: Admin's first name
     - **Last Name**: Admin's last name
     - **Job Title**: Defaults to "Admin"
     - **Employer**: Company or organization name
     - **Location**: City, State or region

3. **Submit and Share Credentials**
   - Click "Create User"
   - If auto-generated, a modal will display the secure password
   - **IMPORTANT:** Copy the password immediately - it won't be shown again
   - Share the email and password securely with the new admin
   - The admin can change their password after first login

### Features
- Email is auto-confirmed (no verification email needed)
- Secure password generation (16 characters with mixed case, numbers, symbols)
- Option to set custom password or auto-generate
- User profile is automatically created
- Email column shows in the users table
- One-click password copy to clipboard

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
   - Enter custom password or press Enter to auto-generate

4. **Copy the credentials**
   - The script will display email and password
   - Share these credentials securely with the new admin user
   - They can change the password after signing in

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

3. **Set Password**
   - In the same user creation form, you can set a temporary password
   - Or use "Send Magic Link" to let them set their own password
   - Share the credentials securely with the user

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

1. **Password Security**
   - Auto-generated passwords are 16 characters with mixed case, numbers, and symbols
   - Custom passwords must be at least 8 characters
   - Passwords are only displayed once - ensure they are securely stored
   - Users should change passwords after first login

2. **Credential Sharing**
   - Share credentials through secure channels (encrypted email, password managers)
   - Never send passwords in plain text via unsecured channels
   - Consider using a password management tool for sharing

3. **Access Control**
   - All admin users currently have equal permissions
   - Consider implementing role-based access control (RBAC) for granular permissions

4. **Password Policies**
   - Encourage users to change default passwords immediately
   - Recommend strong, unique passwords
   - Consider implementing password expiration policies

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
- **Cause**: Wrong credentials or profile not created
- **Solution**: 
  - Verify email and password are correct
  - Check Supabase Dashboard → Authentication → Users
  - Verify email is confirmed
  - Check user_profiles table for profile record
  - Reset password if needed via Supabase dashboard

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
5. **Secure password sharing** - use encrypted channels and password managers
6. **Force password change** - require users to change auto-generated passwords
7. **Monitor activity** - track submission and review activity by admin users
8. **Password rotation** - periodically require password updates

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

