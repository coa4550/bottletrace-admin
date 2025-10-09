# Database Migration: Remove States from Supplier Relationships

## Overview
This migration simplifies the brand-supplier relationship model by removing state-level tracking. Brand-supplier relationships are now assumed to be **nationwide**.

**Important:** Distributor relationships (`brand_distributor_state`) are NOT affected and continue to use state-level tracking.

## Before Migration
- Table: `brand_supplier_state`
- Structure: `brand_id`, `supplier_id`, `state_id` (composite key)
- Example: "Brand X" + "Supplier Y" = 52 rows (one per state)

## After Migration
- Table: `brand_supplier`
- Structure: `brand_id`, `supplier_id` (composite key, no state_id)
- Example: "Brand X" + "Supplier Y" = 1 row

## Migration Steps

### 1. Backup Your Data (CRITICAL!)
```sql
-- Create backup table
CREATE TABLE brand_supplier_state_backup AS 
SELECT * FROM brand_supplier_state;
```

### 2. Run the Migration
Execute the SQL file in Supabase SQL Editor:
```
migrations/remove_states_from_suppliers.sql
```

### 3. Verify the Migration
```sql
-- Check relationship counts
SELECT COUNT(*) as total_relationships FROM brand_supplier;
SELECT COUNT(DISTINCT brand_id) as unique_brands FROM brand_supplier;
SELECT COUNT(DISTINCT supplier_id) as unique_suppliers FROM brand_supplier;

-- Example: If you had 1,872 rows before (36 brands × 52 states)
-- You should have 36 rows after (36 unique brand-supplier pairs)
```

### 4. Deploy Updated Code
After running the SQL migration, deploy the updated application code that references the new `brand_supplier` table.

## Rollback Plan
If something goes wrong:
```sql
-- Restore from backup
DROP TABLE brand_supplier;
ALTER TABLE brand_supplier_state_backup RENAME TO brand_supplier_state;
```

## What Changes in the Code
- Import: No longer creates 52 rows per supplier-brand
- Import: Removes "ALL" states functionality for suppliers
- Import: State dropdown removed from supplier imports
- Audit: Simplified supplier portfolio queries
- Orphans: Adjusted for new structure

## Notes
- The migration keeps the most recently verified relationship when deduplicating
- All foreign keys and indexes are recreated
- The `core_orphans` table is also updated if it exists
- **Distributor relationships are unchanged**

