-- Migration: Consolidate Verification Workflow
-- Purpose: Remove admin-specific verification columns and consolidate to standard verification
-- Date: 2025-10-14
-- 
-- This migration removes the duplicate admin verification columns (verified_by_admin_id, admin_verified_at)
-- and keeps only the standard verification columns (is_verified, last_verified_at).
-- 
-- Verification will continue to be triggered by:
-- - Manual approval of user-submitted orphan corrections by an admin
-- - CSV import of supplier/distributor portfolios (both creates and updates)

-- Drop admin verification columns from brand_supplier table
ALTER TABLE brand_supplier 
  DROP COLUMN IF EXISTS verified_by_admin_id,
  DROP COLUMN IF EXISTS admin_verified_at;

-- Drop admin verification columns from distributor_supplier_state table
ALTER TABLE distributor_supplier_state 
  DROP COLUMN IF EXISTS verified_by_admin_id,
  DROP COLUMN IF EXISTS admin_verified_at;

-- Verification queries to confirm migration
-- Check brand_supplier columns (should not include admin verification columns)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'brand_supplier' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check distributor_supplier_state columns (should not include admin verification columns)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'distributor_supplier_state' 
  AND table_schema = 'public'
ORDER BY ordinal_position;


