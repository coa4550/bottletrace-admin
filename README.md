# BottleTrace Admin Portal

A comprehensive admin portal for managing the BottleTrace spirits database, including brands, suppliers, distributors, relationships, and user submissions.

## Features

### Data Management
- **Brands, Suppliers & Distributors**: Full CRUD operations for core entities
- **Relationships**: Manage brand-supplier and distributor-supplier-state relationships
- **Categories**: Organize brands into categories and sub-categories
- **Bulk Operations**: Multi-row selection and bulk editing
- **CSV Import**: Bulk upload for brand portfolios, supplier portfolios, and distributor portfolios
- **Orphan Detection**: Identify and correct orphaned records

### Review & Approval System
- **User Submissions**: Review and approve/reject user-submitted brands, suppliers, and distributors
- **User Reviews**: Moderate user reviews for brands, suppliers, and distributors
- **Approval Workflow**: Comprehensive review process with admin notes

### Data Visualization
- **Relationship Visualizer**: D3 Sankey diagram showing brand-supplier-distributor relationships
- **Dashboard Metrics**: Track submissions, reviews, and entity counts

### Admin User Management
- **Create Admin Users**: UI and CLI tools for creating admin accounts
- **User Management**: View all users, track submissions and reviews
- **Secure Password Generation**: Auto-generate strong passwords or set custom ones
- **Email/Password Authentication**: Traditional username and password login

### Data Quality
- **Validation**: Pre-import validation for CSV files
- **Import Logs**: Track all data import sessions with detailed change logs
- **Audit Tools**: Review distributor and supplier portfolios for data quality

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase project with required tables
- Environment variables configured

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/coa4550/bottletrace-admin.git
   cd bottletrace-admin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   N8N_CSV_UPLOAD_WEBHOOK_URL=https://coadata.app.n8n.cloud/webhook/distributor-csv-upload
   ```
   
   **Note:** The N8N webhook URL is used for the Distributor Data Normalization feature on the Import Distributor Portfolio page.

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open the portal**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Creating Admin Users

### Method 1: Using the Web UI (Recommended)

1. Log in to the admin portal
2. Navigate to **Users** page
3. Click **+ Create Admin User**
4. Fill in the user details (choose auto-generate password or set custom)
5. Submit and copy the credentials to share with the new admin

### Method 2: Using the CLI Script

```bash
npm run create-admin
```

Or with arguments:
```bash
node scripts/create-admin.js --email admin@example.com --firstName John --lastName Doe --password MySecurePass123!
```

Passwords can be auto-generated (secure 16-character default) or custom.

For detailed instructions, see [ADMIN_USER_SETUP.md](./ADMIN_USER_SETUP.md)

## Deployment

### Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Add environment variables
   - Deploy

3. **Environment Variables**
   
   Add these in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `N8N_CSV_UPLOAD_WEBHOOK_URL` (optional, for Distributor Data Normalization feature)

## Project Structure

```
bottletrace-admin-bulk/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   ├── brands/          # Brand endpoints
│   │   ├── suppliers/       # Supplier endpoints
│   │   ├── distributors/    # Distributor endpoints
│   │   ├── import/          # CSV import endpoints
│   │   ├── submissions/     # User submission endpoints
│   │   ├── reviews/         # Review approval endpoints
│   │   └── users/           # User management endpoints
│   ├── brands/              # Brands page
│   ├── suppliers/           # Suppliers page
│   ├── distributors/        # Distributors page
│   ├── relationships/       # Relationship management pages
│   ├── import/              # CSV import pages
│   ├── reviews/             # Review approval page
│   ├── users/               # User management page
│   ├── audit/               # Data audit pages
│   └── visualize/           # Data visualization pages
├── components/              # Reusable React components
├── lib/                     # Utility libraries
│   └── supabaseAdmin.js    # Supabase admin client
├── migrations/              # Database migration files
├── scripts/                 # Utility scripts
│   └── create-admin.js     # CLI tool for creating admin users
└── README.md               # This file
```

## Key Pages

- **Dashboard** (`/`): Overview and quick stats
- **Brands** (`/brands`): Manage all spirit brands
- **Suppliers** (`/suppliers`): Manage brand suppliers
- **Distributors** (`/distributors`): Manage distributors
- **States** (`/states`): Manage states/regions
- **Categories** (`/categories`): Manage brand categories
- **Sub-Categories** (`/sub-categories`): Manage brand sub-categories
- **Relationships** (`/relationships/*`): Manage brand-supplier and distributor-supplier relationships
- **Import** (`/import/*`): CSV import tools for brands and portfolios
- **Reviews** (`/reviews`): Review and moderate user reviews
- **Submissions** (`/admin/submissions`): Approve/reject user submissions
- **Users** (`/users`): Manage admin and regular users
- **Visualize** (`/visualize/relationships`): D3 Sankey diagram of relationships
- **Audit** (`/audit/*`): Data quality audit tools

## API Documentation

### User Management

- `POST /api/users` - Create a new admin user
- `GET /api/users` - List all users with profiles
- `DELETE /api/users?userId={id}` - Delete a user

### Import Operations

- `POST /api/import/parse` - Parse CSV file
- `POST /api/import/validate` - Validate import data
- `POST /api/import/brand/validate` - Validate brand import
- `POST /api/import/supplier-portfolio/validate` - Validate supplier portfolio
- `POST /api/import/distributor-portfolio/validate` - Validate distributor portfolio
- `POST /api/import/commit` - Commit validated import
- `POST /api/import/distributor-normalization/upload` - Upload CSV to N8N for normalization
- `POST /api/import/distributor-normalization/preview` - Fetch and parse CSV preview

### Submissions

- `GET /api/submissions` - Get user submission
- `GET /api/submissions/list` - List all submissions
- `POST /api/submissions/{id}/approve` - Approve a submission
- `POST /api/submissions/{id}/reject` - Reject a submission

### Reviews

- `POST /api/reviews/{id}/approve` - Approve a user review
- `POST /api/reviews/{id}/deny` - Deny a user review

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Documentation

- [Admin User Setup Guide](./ADMIN_USER_SETUP.md) - Detailed guide for creating and managing admin users
- [Review Approval Workflow](./migrations/REVIEW_APPROVAL_WORKFLOW.md) - Review and approval process documentation
- [Lost Bottles Implementation](./LOST_BOTTLES_IMPLEMENTATION.md) - Lost bottles feature documentation

## License

Private - All Rights Reserved
