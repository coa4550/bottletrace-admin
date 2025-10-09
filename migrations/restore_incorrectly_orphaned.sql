-- Restore relationships that were incorrectly orphaned due to batching bug
-- This moves relationships from core_orphans back to brand_supplier

-- Step 1: Insert orphaned relationships back into active table
INSERT INTO brand_supplier (brand_id, supplier_id, is_verified, last_verified_at, relationship_source, created_at)
SELECT 
    brand_id,
    supplier_id,
    was_verified as is_verified,
    last_verified_at,
    relationship_source,
    created_at
FROM core_orphans
WHERE reason = 'not_in_import'
ON CONFLICT (brand_id, supplier_id) DO UPDATE
SET 
    is_verified = EXCLUDED.is_verified,
    last_verified_at = EXCLUDED.last_verified_at,
    relationship_source = 'restored_from_orphans';

-- Step 2: Delete the restored orphans from core_orphans
DELETE FROM core_orphans
WHERE reason = 'not_in_import';

-- Verification: Check how many relationships were restored
-- SELECT COUNT(*) as restored_count FROM brand_supplier WHERE relationship_source = 'restored_from_orphans';

