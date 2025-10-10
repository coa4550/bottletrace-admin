-- Fix distributor_supplier_state table structure
-- Remove default UUID generators that were conflicting with explicit UUID inserts

-- The table had DEFAULT gen_random_uuid() on foreign key columns which caused
-- the import process to insert random UUIDs instead of the actual IDs

ALTER TABLE distributor_supplier_state 
ALTER COLUMN distributor_id DROP DEFAULT,
ALTER COLUMN supplier_id DROP DEFAULT,
ALTER COLUMN state_id DROP DEFAULT;

-- Fix the primary key: it was only on distributor_id, but should be a composite key
-- This was preventing multiple relationships per distributor

ALTER TABLE distributor_supplier_state DROP CONSTRAINT distributor_supplier_state_pkey;

ALTER TABLE distributor_supplier_state 
ADD CONSTRAINT distributor_supplier_state_pkey 
PRIMARY KEY (distributor_id, supplier_id, state_id);

-- Make supplier_id and state_id NOT NULL since they're part of the primary key

ALTER TABLE distributor_supplier_state 
ALTER COLUMN supplier_id SET NOT NULL,
ALTER COLUMN state_id SET NOT NULL;

-- This allows the import process to properly insert explicit UUIDs
-- that reference actual distributors, suppliers, and states
