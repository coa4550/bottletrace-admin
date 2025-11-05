# Distributor SKU Normalization Workflow

## Overview
This workflow processes CSV files from distributors containing SKU-level data for spirit brands and normalizes them to extract unique brand-level information including Brand name, Supplier name, and Spirit categories.

## Input Requirements

### Expected CSV Structure
The distributor CSV file should contain columns like:
- `SKU` or `Product Code` - Individual product identifiers
- `Brand Name` or `Brand` - Brand name
- `Supplier Name` or `Supplier` - Supplier/manufacturer name
- `Category` or `Spirit Category` - Category (e.g., "Whiskey", "Vodka", "Rum")
- `Sub-Category` (optional) - More specific category
- `Product Name` (optional) - Full product name for validation
- Any other distributor-specific columns

**Note:** Column names may vary by distributor. The workflow should support flexible column mapping.

## Workflow Steps

### Step 1: File Upload & Parsing
1. User uploads CSV file via web interface
2. System parses CSV and displays preview
3. User maps CSV columns to expected fields:
   - Brand Name
   - Supplier Name
   - Category/Categories
   - Sub-Category (optional)
   - SKU (used for grouping, not stored)

### Step 2: Data Extraction & Grouping
**Key Normalization Logic:**
- Group all rows by `Brand Name` (case-insensitive)
- For each unique brand:
  - Extract distinct Supplier names
  - Extract distinct Categories
  - Extract distinct Sub-Categories
  - Count SKUs per brand
  - Collect sample SKU/product names for reference

**Output:** Unique brand records with aggregated data

### Step 3: Data Validation
**Validation Checks:**
1. **Brand Name**
   - Must not be empty
   - Should be normalized (trim, remove extra spaces)
   - Flag potential duplicates (same name, different suppliers)

2. **Supplier Name**
   - Must not be empty for each brand
   - Should be normalized (trim, title case)
   - Check if supplier exists in database
   - Flag if multiple suppliers for same brand (requires review)

3. **Categories**
   - Must have at least one category
   - Validate against existing categories in database
   - Flag unknown/new categories for creation
   - Normalize category names (standardize capitalization)

4. **Data Quality Checks**
   - Flag brands with inconsistent supplier names
   - Flag brands with mixed categories that seem incorrect
   - Flag very long or suspicious brand names

### Step 4: Brand Matching & Deduplication
**Matching Strategy:**
1. **Exact Match**
   - Compare normalized brand names exactly
   - Match existing brands in database

2. **Fuzzy Match**
   - Use similarity algorithm (Levenshtein distance)
   - Match threshold: 75% similarity
   - Prioritize matches where first word matches

3. **First Word Match**
   - If first significant word matches, suggest as potential match
   - Example: "The Macallan 18" matches "Macallan 12"

**For Each Brand:**
- Show existing match (if any)
- Show similarity score
- Allow user to:
  - Create new brand
  - Use existing brand (merge/enrich)
  - Review fuzzy matches

### Step 5: Supplier Normalization
**For Each Unique Supplier:**
- Check if supplier exists in database
- Fuzzy match against existing suppliers
- Allow user to:
  - Create new supplier
  - Map to existing supplier
  - Review matches

**Supplier-Brand Relationships:**
- Link brand to supplier(s)
- Handle cases where one brand has multiple suppliers
- Create/update `brand_supplier` relationships

### Step 6: Category Processing
**For Each Brand:**
- Extract all unique categories from grouped SKUs
- Validate categories exist in database
- Create new categories if needed (with approval)
- Link brands to categories via `brand_categories` table
- Process sub-categories similarly

**Category Normalization:**
- Standardize category names (e.g., "Whiskey" vs "Whisky")
- Map common variations to standard categories
- Handle comma-separated category lists

### Step 7: Review & Approval
**Display Summary:**
- Total brands extracted
- New brands to create
- Existing brands to update/enrich
- Brands requiring review (conflicts, duplicates)
- Suppliers to create
- Categories to create

**User Actions:**
- Review each brand match/creation
- Confirm fuzzy matches
- Resolve conflicts (multiple suppliers, etc.)
- Approve new categories/suppliers

### Step 8: Import Execution
**Batch Processing:**
1. Create new suppliers (if approved)
2. Create new categories (if approved)
3. Create/update brands
4. Link brands to suppliers
5. Link brands to categories
6. Link brands to sub-categories
7. Log all changes to `import_logs` and `import_changes`

**Error Handling:**
- Rollback on critical errors
- Continue processing non-critical errors
- Report errors with row numbers and reasons

## Data Models

### Extracted Brand Record
```javascript
{
  brand_name: string,           // Normalized brand name
  supplier_names: string[],    // Array of unique suppliers
  categories: string[],        // Array of unique categories
  sub_categories: string[],    // Array of unique sub-categories
  sku_count: number,           // Number of SKUs for this brand
  sample_skus: string[],       // Sample SKU/product names
  source_rows: object[],       // Original CSV rows for this brand
  match_status: 'new' | 'exact' | 'fuzzy' | 'conflict',
  matched_brand_id: number | null,
  similarity_score: number | null
}
```

### Import Payload
```javascript
{
  brands: [
    {
      brand_name: string,
      supplier_id: number,              // Primary supplier
      category_ids: number[],
      sub_category_ids: number[],
      confirmed_matches: {
        use_existing: boolean,
        existing_brand_id: number | null,
        supplier_matches: {
          supplier_name: string,
          supplier_id: number | null,
          create_new: boolean
        }[]
      }
    }
  ],
  new_suppliers: string[],
  new_categories: string[],
  fileName: string
}
```

## Implementation Components

### 1. Frontend Page
**Location:** `app/import/distributor-sku-normalization/page.js`

**Features:**
- CSV file upload
- Column mapping interface
- Preview of normalized brands (before grouping)
- Grouped brand display (after normalization)
- Brand matching interface
- Review and approval interface
- Progress tracking

### 2. Parse API
**Location:** `app/api/import/distributor-sku-normalization/parse/route.js`

**Functionality:**
- Parse CSV file
- Map columns to expected fields
- Return parsed rows for preview

### 3. Normalize API
**Location:** `app/api/import/distributor-sku-normalization/normalize/route.js`

**Functionality:**
- Group rows by brand name
- Extract unique suppliers, categories, sub-categories
- Return normalized brand records

### 4. Validate API
**Location:** `app/api/import/distributor-sku-normalization/validate/route.js`

**Functionality:**
- Validate normalized brands
- Match against existing brands (exact + fuzzy)
- Match suppliers
- Validate categories
- Return validation results with matches and conflicts

### 5. Import API
**Location:** `app/api/import/distributor-sku-normalization/route.js`

**Functionality:**
- Process confirmed brands
- Create/update brands
- Create suppliers and categories (if needed)
- Link relationships
- Log all changes

## Normalization Rules

### Brand Name Normalization
1. Trim whitespace
2. Remove extra spaces (collapse multiple spaces to single)
3. Preserve capitalization (don't force title case - brands have specific capitalization)
4. Handle common prefixes: Remove leading "The " for matching (but preserve in stored name)

### Supplier Name Normalization
1. Trim whitespace
2. Title case (capitalize first letter of each word)
3. Remove common suffixes: "Inc.", "LLC", "Ltd." (for matching, preserve in stored name)
4. Standardize common variations

### Category Normalization
1. Trim whitespace
2. Title case
3. Map common variations:
   - "Whiskey" ↔ "Whisky"
   - "Bourbon Whiskey" → "Bourbon"
   - Handle plural/singular forms

### Grouping Logic
```javascript
// Pseudocode
function normalizeSKUData(csvRows) {
  const brandMap = new Map();
  
  for (const row of csvRows) {
    const brandName = normalizeBrandName(row.brand_name);
    
    if (!brandMap.has(brandName)) {
      brandMap.set(brandName, {
        brand_name: brandName,
        supplier_names: new Set(),
        categories: new Set(),
        sub_categories: new Set(),
        skus: new Set(),
        source_rows: []
      });
    }
    
    const brandData = brandMap.get(brandName);
    brandData.supplier_names.add(normalizeSupplierName(row.supplier_name));
    brandData.categories.add(normalizeCategory(row.category));
    if (row.sub_category) {
      brandData.sub_categories.add(normalizeCategory(row.sub_category));
    }
    brandData.skus.add(row.sku);
    brandData.source_rows.push(row);
  }
  
  // Convert Sets to Arrays
  return Array.from(brandMap.values()).map(b => ({
    ...b,
    supplier_names: Array.from(b.supplier_names),
    categories: Array.from(b.categories),
    sub_categories: Array.from(b.sub_categories),
    sku_count: b.skus.size,
    sample_skus: Array.from(b.skus).slice(0, 5)
  }));
}
```

## Edge Cases & Handling

### Multiple Suppliers for Same Brand
- **Scenario:** Different SKUs of same brand have different suppliers
- **Action:** Flag for review, show both suppliers
- **Decision:** User can choose primary supplier or create multiple brand-supplier relationships

### Inconsistent Category Data
- **Scenario:** Same brand has conflicting categories (e.g., "Whiskey" and "Vodka")
- **Action:** Flag as conflict, show source SKUs
- **Decision:** User reviews and selects correct categories

### Very Large Files
- **Scenario:** CSV has thousands of SKUs
- **Action:** Process in batches, show progress
- **Implementation:** Chunk processing, paginate results

### Missing Critical Data
- **Scenario:** Row missing brand name or supplier
- **Action:** Skip row, log error, continue processing
- **Reporting:** Show count of skipped rows in summary

### Brand Name Variations
- **Scenario:** "Macallan" vs "The Macallan" vs "Macallan 12"
- **Action:** Group and match intelligently
- **Strategy:** Use fuzzy matching, first-word matching, allow user override

## User Experience Flow

1. **Upload Page**
   - Drag & drop or browse for CSV
   - Show file info and row count

2. **Column Mapping**
   - Auto-detect common column names
   - Allow manual mapping
   - Preview first 10 rows

3. **Normalization Preview**
   - Show grouped brands (before validation)
   - Display: Brand, Supplier(s), Categories, SKU Count
   - Allow editing/merging before validation

4. **Validation Results**
   - Three sections:
     - **Exact Matches:** Existing brands found
     - **Fuzzy Matches:** Similar brands (with similarity scores)
     - **New Brands:** No matches found
   - Show conflicts and issues
   - Allow user to confirm matches or create new

5. **Review & Approve**
   - Summary of changes
   - Review new suppliers
   - Review new categories
   - Final approval button

6. **Import Progress**
   - Show progress bar
   - Display counts (brands created, updated, linked)
   - Show errors if any

7. **Import Complete**
   - Summary report
   - Link to import log
   - Option to download summary CSV

## Success Metrics

- **Normalization Rate:** % of SKUs successfully grouped into brands
- **Match Accuracy:** % of brands correctly matched to existing records
- **Data Quality:** % of brands with complete supplier and category data
- **Processing Speed:** Rows processed per second

## Future Enhancements

1. **Automatic SKU Pattern Recognition**
   - Learn common SKU patterns per distributor
   - Auto-extract brand from SKU format

2. **Machine Learning for Matching**
   - Train model on brand name variations
   - Improve fuzzy matching accuracy

3. **Batch Processing**
   - Process multiple distributor files
   - Schedule regular imports

4. **Data Quality Dashboard**
   - Track normalization statistics
   - Identify common data quality issues

5. **Supplier Deduplication**
   - Automatic supplier merging
   - Handle supplier name variations





