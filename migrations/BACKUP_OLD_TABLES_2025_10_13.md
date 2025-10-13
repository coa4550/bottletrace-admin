# Backup of OLD Tables - October 13, 2025

## Summary
This backup was created before deleting all OLD-prefixed tables from the Supabase database.
These tables were part of the legacy schema that was migrated to the new UUID-based schema in October 2025.

## Tables Backed Up

| Table Name | Row Count | Columns | Last Updated |
|------------|-----------|---------|--------------|
| OLD_brands | 1,738 | 15 | 2025-09-22 |
| OLD_suppliers | 1,118 | 11 | 2025-09-26 |
| OLD_distributors | 28 | 15 | 2025-09-24 |
| OLD_regions | 58 | 5 | N/A |
| OLD_brand_suppliers | 1,738 | 7 | N/A |
| OLD_brand_distributors | 1,738 | 10 | N/A |
| OLD_categories | 73 | 5 | N/A |
| OLD_brand_categories | 1,732 | 5 | N/A |
| [OLD] brand_distributor_state | 1,729 | 7 | N/A |

**Total Records:** 8,950 rows across 9 tables

## Migration Status
✅ All data has been migrated to new schema:
- OLD_brands → core_brands (1,757 rows)
- OLD_suppliers → core_suppliers (138 rows, consolidated)
- OLD_distributors → core_distributors (27 rows)
- OLD_regions → core_states (57 rows)
- OLD_categories → categories (21 rows, consolidated)
- OLD_brand_suppliers → brand_supplier (82 rows, redesigned)

## Safety Checks Performed
1. ✅ No code references to OLD tables found in codebase
2. ✅ No foreign key dependencies from active tables
3. ✅ All OLD tables form isolated data island
4. ✅ Migration completed successfully in October 2025
5. ✅ Tables last modified in September 2025 (stale)

## Restoration Instructions
If you need to restore this data:
1. Contact your database administrator
2. Restore from Supabase point-in-time backup (available for 7-30 days depending on plan)
3. Specific restore point: October 13, 2025 (before deletion)

## Table Schemas

### OLD_brands
```sql
CREATE TABLE "OLD_brands" (
    id bigint PRIMARY KEY,
    name text NOT NULL UNIQUE,
    verified boolean DEFAULT false,
    verified_at timestamptz,
    created_at timestamptz DEFAULT now(),
    website text,
    image text,
    created timestamptz,
    updated timestamptz,
    delete_flag boolean DEFAULT false,
    ads boolean DEFAULT false,
    updated_at timestamptz DEFAULT now(),
    data_source text DEFAULT 'unknown',
    category_id integer,
    is_active boolean NOT NULL DEFAULT true
);
```

### OLD_suppliers
```sql
CREATE TABLE "OLD_suppliers" (
    id bigint PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now(),
    website text,
    image text,
    created timestamptz,
    updated timestamptz,
    delete_flag boolean DEFAULT false,
    ads boolean DEFAULT false,
    updated_at timestamptz DEFAULT now(),
    is_active boolean NOT NULL DEFAULT true
);
```

### OLD_distributors
```sql
CREATE TABLE "OLD_distributors" (
    id bigint PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now(),
    website text,
    image text,
    purchase_link text,
    purchase_label text,
    created timestamptz,
    updated timestamptz,
    products text,
    manufacturer_count integer,
    delete_flag boolean DEFAULT false,
    ads boolean DEFAULT false,
    updated_at timestamptz DEFAULT now(),
    is_active boolean NOT NULL DEFAULT true
);
```

### OLD_regions
```sql
CREATE TABLE "OLD_regions" (
    id bigint PRIMARY KEY,
    code text NOT NULL UNIQUE,
    description text,
    created_at timestamptz DEFAULT now(),
    is_active boolean NOT NULL DEFAULT true
);
```

### OLD_brand_suppliers
```sql
CREATE TABLE "OLD_brand_suppliers" (
    brand_id bigint NOT NULL,
    supplier_id bigint NOT NULL,
    confidence_score numeric DEFAULT 0.85 CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
    is_active boolean NOT NULL DEFAULT true,
    is_verified boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (brand_id, supplier_id)
);
```

### OLD_brand_distributors
```sql
CREATE TABLE "OLD_brand_distributors" (
    brand_id bigint NOT NULL,
    distributor_id bigint NOT NULL,
    region_id bigint NOT NULL,
    confidence_score numeric DEFAULT 0.85 CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
    is_active boolean NOT NULL DEFAULT true,
    is_verified boolean NOT NULL DEFAULT false,
    effective_date date,
    end_date date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (brand_id, distributor_id, region_id)
);
```

### OLD_categories
```sql
CREATE TABLE "OLD_categories" (
    id integer PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

### OLD_brand_categories
```sql
CREATE TABLE "OLD_brand_categories" (
    id integer PRIMARY KEY,
    brand_id integer NOT NULL,
    category_id integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

### [OLD] brand_distributor_state
```sql
CREATE TABLE "[OLD] brand_distributor_state" (
    brand_id uuid NOT NULL,
    distributor_id uuid NOT NULL,
    state_id uuid NOT NULL,
    is_verified boolean,
    last_verified_at timestamptz,
    relationship_source text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (brand_id, distributor_id, state_id)
);
```

## Notes
- This backup file serves as documentation and schema reference
- Actual data is preserved in Supabase's automated backups
- If full data export is needed, use Supabase's export functionality
- Deletion performed via migration: `drop_old_tables_after_backup`

