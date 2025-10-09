-- Migration: Remove states from supplier relationships
-- Date: 2025-01-09
-- Description: Simplifies brand-supplier relationships by removing state-level tracking
--              Brand-supplier relationships are now assumed to be nationwide

-- Step 1: Create temporary table with deduplicated data (one row per brand-supplier pair)
CREATE TABLE brand_supplier_temp AS
SELECT DISTINCT ON (brand_id, supplier_id)
    brand_id,
    supplier_id,
    is_verified,
    last_verified_at,
    relationship_source,
    created_at,
    updated_at
FROM brand_supplier_state
ORDER BY brand_id, supplier_id, last_verified_at DESC NULLS LAST;

-- Step 2: Drop the old table
DROP TABLE brand_supplier_state;

-- Step 3: Rename temp table to final name
ALTER TABLE brand_supplier_temp RENAME TO brand_supplier;

-- Step 4: Add primary key
ALTER TABLE brand_supplier 
ADD CONSTRAINT brand_supplier_pkey PRIMARY KEY (brand_id, supplier_id);

-- Step 5: Add foreign key constraints
ALTER TABLE brand_supplier
ADD CONSTRAINT brand_supplier_brand_id_fkey 
FOREIGN KEY (brand_id) REFERENCES core_brands(brand_id) ON DELETE CASCADE;

ALTER TABLE brand_supplier
ADD CONSTRAINT brand_supplier_supplier_id_fkey 
FOREIGN KEY (supplier_id) REFERENCES core_suppliers(supplier_id) ON DELETE CASCADE;

-- Step 6: Add indexes for performance
CREATE INDEX idx_brand_supplier_brand_id ON brand_supplier(brand_id);
CREATE INDEX idx_brand_supplier_supplier_id ON brand_supplier(supplier_id);
CREATE INDEX idx_brand_supplier_verified ON brand_supplier(is_verified);

-- Step 7: Update core_orphans table if it exists (remove state_id)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'core_orphans') THEN
        -- Create new orphans table without state_id
        CREATE TABLE core_orphans_temp AS
        SELECT DISTINCT ON (brand_id, supplier_id)
            orphan_id,
            brand_id,
            supplier_id,
            was_verified,
            last_verified_at,
            relationship_source,
            reason,
            created_at
        FROM core_orphans
        ORDER BY brand_id, supplier_id, created_at DESC;
        
        DROP TABLE core_orphans;
        ALTER TABLE core_orphans_temp RENAME TO core_orphans;
        
        ALTER TABLE core_orphans
        ADD CONSTRAINT core_orphans_pkey PRIMARY KEY (orphan_id);
    END IF;
END $$;

-- Verification queries (run these to check the migration)
-- SELECT COUNT(*) as total_relationships FROM brand_supplier;
-- SELECT COUNT(DISTINCT brand_id) as unique_brands FROM brand_supplier;
-- SELECT COUNT(DISTINCT supplier_id) as unique_suppliers FROM brand_supplier;

