-- Migration: Add is_verified column to distributor_supplier_state
-- Purpose: Ensure consistency between brand_supplier and distributor_supplier_state verification columns
-- Date: 2025-10-14
-- 
-- Both tables should have the same verification columns:
-- - is_verified (boolean)
-- - last_verified_at (timestamp)

-- Add is_verified column to distributor_supplier_state
ALTER TABLE distributor_supplier_state 
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

-- For existing records, set is_verified to true if last_verified_at is not null
UPDATE distributor_supplier_state 
SET is_verified = true 
WHERE last_verified_at IS NOT NULL;

-- Verification query
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'distributor_supplier_state' 
  AND table_schema = 'public'
ORDER BY ordinal_position;


