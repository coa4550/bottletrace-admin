-- Fix distributor_supplier_state table structure
-- Remove default UUID generators that were conflicting with explicit UUID inserts

-- The table had DEFAULT gen_random_uuid() on foreign key columns which caused
-- the import process to insert random UUIDs instead of the actual IDs

ALTER TABLE distributor_supplier_state 
ALTER COLUMN distributor_id DROP DEFAULT,
ALTER COLUMN supplier_id DROP DEFAULT,
ALTER COLUMN state_id DROP DEFAULT;

-- This allows the import process to properly insert explicit UUIDs
-- that reference actual distributors, suppliers, and states
