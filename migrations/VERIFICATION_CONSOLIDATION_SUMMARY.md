# Verification Workflow Consolidation

**Date:** October 14, 2025  
**Migration:** `consolidate_verification_columns.sql`

## Overview

This migration consolidates the verification workflow by removing duplicate admin-specific verification columns and standardizing on a single set of verification columns across the application.

## Changes Made

### Database Schema Changes

#### 1. **brand_supplier** table
**Removed columns:**
- `verified_by_admin_id` (uuid)
- `admin_verified_at` (timestamp with time zone)

**Retained columns:**
- `is_verified` (boolean)
- `last_verified_at` (timestamp with time zone)
- `relationship_source` (text)
- `created_at` (timestamp with time zone)

#### 2. **distributor_supplier_state** table
**Removed columns:**
- `verified_by_admin_id` (uuid)
- `admin_verified_at` (timestamp with time zone)

**Added columns:**
- `is_verified` (boolean, default: false)

**Retained columns:**
- `last_verified_at` (timestamp with time zone)
- `created_at` (timestamp with time zone)

### Code Changes

#### 1. Updated `/app/audit/distributor-portfolio/page.js`
- Changed references from `admin_verified_at` to `last_verified_at`
- Updated relationship metadata enrichment to use standard verification columns
- Line 101: Added `last_verified_at` and `is_verified` to enriched suppliers
- Line 441: Changed `VerifiedDate` component to use `last_verified_at` instead of `admin_verified_at`

#### 2. Updated `/app/api/import/distributor-portfolio/route.js`
- Line 302-303: New relationships now include `is_verified: true` and `last_verified_at: now`
- Line 321-337: Existing relationships are now updated with `is_verified: true` and `last_verified_at: now` during import

#### 3. Updated `/app/api/submissions/[id]/approve/route.js`
- Line 165-166: When creating distributor-supplier-state relationships from approved submissions, now sets `is_verified: true` and `last_verified_at: current timestamp`

## Verification Triggers

The system now has a **unified verification workflow** with two triggers:

### 1. Manual Approval of User Submissions
**Location:** `/app/api/submissions/[id]/approve/route.js`

When an admin approves a user-submitted orphan correction, the system automatically sets:
```javascript
{
  is_verified: true,
  last_verified_at: new Date().toISOString()
}
```

### 2. CSV Import of Portfolios
**Locations:**
- `/app/api/import/supplier-portfolio/route.js`
- `/app/api/import/distributor-portfolio/route.js`

When importing supplier or distributor portfolios via CSV:
- **New relationships** are created with `is_verified: true` and `last_verified_at: now`
- **Existing relationships** are updated with `is_verified: true` and `last_verified_at: now`

This ensures that CSV imports from authoritative sources automatically verify relationships.

## Benefits

1. **Simplified schema**: Reduced column duplication across verification workflows
2. **Clearer semantics**: Single source of truth for verification status
3. **Consistent behavior**: All verification triggers use the same columns
4. **Easier maintenance**: Less confusion about which columns to use for verification

## Migration Safety

- Used `DROP COLUMN IF EXISTS` to ensure idempotent migrations
- All code references updated before applying the migration
- Verified successful column removal via information_schema queries

## Verification Status

✅ Migration applied successfully (consolidate_verification_columns.sql)  
✅ Admin verification columns removed from both tables  
✅ `is_verified` column added to distributor_supplier_state table (add_is_verified_to_distributor_supplier_state.sql)  
✅ Code updated to use standard verification columns across all workflows  
✅ Both tables now have consistent verification schema: `is_verified` + `last_verified_at`  
✅ No breaking changes to application functionality

