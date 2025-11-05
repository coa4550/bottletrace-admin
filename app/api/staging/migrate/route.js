import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const STAGING_TABLES = {
  brands: 'staging_brands',
  suppliers: 'staging_suppliers',
  distributors: 'staging_distributors',
  'supplier-portfolio': 'staging_supplier_portfolio',
  'distributor-portfolio': 'staging_distributor_portfolio'
};

export async function POST(req) {
  try {
    const { type, importLogId } = await req.json();

    const tableName = STAGING_TABLES[type];
    if (!tableName) {
      return NextResponse.json({ error: 'Invalid staging type' }, { status: 400 });
    }

    // Fetch approved rows from staging
    let query = supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('is_approved', true);

    if (importLogId) {
      query = query.eq('import_log_id', importLogId);
    }

    const { data: stagingRows, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!stagingRows || stagingRows.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No approved rows to migrate',
        migrated: 0,
        errors: []
      });
    }

    const migratedIds = [];
    const errors = [];
    let summary = {
      brandsCreated: 0,
      brandsUpdated: 0,
      suppliersCreated: 0,
      suppliersUpdated: 0,
      distributorsCreated: 0,
      distributorsUpdated: 0,
      relationshipsCreated: 0,
      categoriesLinked: 0,
      subCategoriesLinked: 0
    };

    // Migrate based on type
    switch (type) {
      case 'brands':
        await migrateBrands(stagingRows, migratedIds, errors, summary);
        break;
      case 'suppliers':
        await migrateSuppliers(stagingRows, migratedIds, errors, summary);
        break;
      case 'distributors':
        await migrateDistributors(stagingRows, migratedIds, errors, summary);
        break;
      case 'supplier-portfolio':
        await migrateSupplierPortfolio(stagingRows, migratedIds, errors, summary);
        break;
      case 'distributor-portfolio':
        await migrateDistributorPortfolio(stagingRows, migratedIds, errors, summary);
        break;
      default:
        throw new Error(`Unknown migration type: ${type}`);
    }

    // Delete migrated staging rows
    if (migratedIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from(tableName)
        .delete()
        .in('staging_id', migratedIds);

      if (deleteError) {
        console.error('Error deleting migrated staging rows:', deleteError);
        // Don't fail the migration if delete fails, but log it
      }
    }

    // Update import log if provided
    if (importLogId) {
      await supabaseAdmin
        .from('import_logs')
        .update({
          status: errors.length > 0 ? 'partial' : 'completed',
          migration_status: 'migrated',
          migration_summary: summary
        })
        .eq('import_log_id', importLogId);
    }

    return NextResponse.json({
      success: true,
      migrated: migratedIds.length,
      total: stagingRows.length,
      errors: errors.slice(0, 20),
      summary
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function migrateBrands(rows, migratedIds, errors, summary) {
  // Fetch categories and sub-categories
  const { data: categoriesData } = await supabaseAdmin
    .from('categories')
    .select('category_id, category_name');
  
  const { data: subCategoriesData } = await supabaseAdmin
    .from('sub_categories')
    .select('sub_category_id, sub_category_name');
  
  // Create mutable copies
  let categories = categoriesData ? [...categoriesData] : [];
  let subCategories = subCategoriesData ? [...subCategoriesData] : [];

  for (const row of rows) {
    try {
      let brandId;
      let wasCreated = false;

      // Check if brand exists
      const { data: existing } = await supabaseAdmin
        .from('core_brands')
        .select('brand_id')
        .eq('brand_name', row.brand_name)
        .maybeSingle();

      if (existing) {
        brandId = existing.brand_id;
        // Update if new data provided
        const updateData = {};
        if (row.brand_url && !existing.brand_url) updateData.brand_url = row.brand_url;
        if (row.brand_logo_url && !existing.brand_logo_url) updateData.brand_logo_url = row.brand_logo_url;
        if (row.data_source) updateData.data_source = row.data_source;

        if (Object.keys(updateData).length > 0) {
          await supabaseAdmin
            .from('core_brands')
            .update(updateData)
            .eq('brand_id', brandId);
          summary.brandsUpdated++;
        }
      } else {
        // Create new brand
        const { data: newBrand, error: createError } = await supabaseAdmin
          .from('core_brands')
          .insert({
            brand_name: row.brand_name,
            brand_url: row.brand_url || null,
            brand_logo_url: row.brand_logo_url || null,
            data_source: row.data_source || 'csv_import'
          })
          .select()
          .single();

        if (createError) throw createError;
        brandId = newBrand.brand_id;
        wasCreated = true;
        summary.brandsCreated++;
      }

      // Process categories
      if (row.brand_categories && brandId) {
        const categoriesArray = row.brand_categories.split(',').map(c => c.trim()).filter(Boolean);
        for (const catName of categoriesArray) {
          let category = categories?.find(c => c.category_name.toLowerCase() === catName.toLowerCase());
          
          // Create category if it doesn't exist
          if (!category) {
            const { data: newCategory, error: createError } = await supabaseAdmin
              .from('categories')
              .insert({ category_name: catName })
              .select()
              .single();
            if (!createError && newCategory) {
              category = newCategory;
              // Update local categories array
              categories.push(category);
            }
          }
          
          if (category) {
            const { error: linkError } = await supabaseAdmin
              .from('brand_categories')
              .upsert({ brand_id: brandId, category_id: category.category_id }, { onConflict: 'brand_id,category_id' });
            if (!linkError) summary.categoriesLinked++;
          }
        }
      }

      // Process sub-categories
      if (row.brand_sub_categories && brandId) {
        const subCategoriesArray = row.brand_sub_categories.split(',').map(c => c.trim()).filter(Boolean);
        for (const subCatName of subCategoriesArray) {
          let subCategory = subCategories?.find(sc => sc.sub_category_name.toLowerCase() === subCatName.toLowerCase());
          
          // Create sub-category if it doesn't exist (need to determine category_id from brand's categories)
          if (!subCategory) {
            // Try to find a category for this sub-category (use first brand category or first available category)
            const { data: brandCategories } = await supabaseAdmin
              .from('brand_categories')
              .select('category_id')
              .eq('brand_id', brandId)
              .limit(1);
            
            const categoryId = brandCategories?.[0]?.category_id || categories?.[0]?.category_id;
            
            if (categoryId) {
              const { data: newSubCategory, error: createError } = await supabaseAdmin
                .from('sub_categories')
                .insert({ 
                  sub_category_name: subCatName,
                  category_id: categoryId
                })
                .select()
                .single();
              if (!createError && newSubCategory) {
                subCategory = newSubCategory;
                // Update local subCategories array
                subCategories.push(subCategory);
              }
            }
          }
          
          if (subCategory) {
            const { error: linkError } = await supabaseAdmin
              .from('brand_sub_categories')
              .upsert({ brand_id: brandId, sub_category_id: subCategory.sub_category_id }, { onConflict: 'brand_id,sub_category_id' });
            if (!linkError) summary.subCategoriesLinked++;
          }
        }
      }

      migratedIds.push(row.staging_id);
    } catch (error) {
      errors.push(`Row ${row.row_index + 1}: ${error.message}`);
    }
  }
}

async function migrateSuppliers(rows, migratedIds, errors, summary) {
  for (const row of rows) {
    try {
      const { data: existing } = await supabaseAdmin
        .from('core_suppliers')
        .select('supplier_id')
        .eq('supplier_name', row.supplier_name)
        .maybeSingle();

      if (existing) {
        const updateData = {};
        if (row.supplier_url && !existing.supplier_url) updateData.supplier_url = row.supplier_url;
        if (row.supplier_logo_url && !existing.supplier_logo_url) updateData.supplier_logo_url = row.supplier_logo_url;

        if (Object.keys(updateData).length > 0) {
          await supabaseAdmin
            .from('core_suppliers')
            .update(updateData)
            .eq('supplier_id', existing.supplier_id);
          summary.suppliersUpdated++;
        }
      } else {
        const { error: createError } = await supabaseAdmin
          .from('core_suppliers')
          .insert({
            supplier_name: row.supplier_name,
            supplier_url: row.supplier_url || null,
            supplier_logo_url: row.supplier_logo_url || null
          });
        if (createError) throw createError;
        summary.suppliersCreated++;
      }

      migratedIds.push(row.staging_id);
    } catch (error) {
      errors.push(`Row ${row.row_index + 1}: ${error.message}`);
    }
  }
}

async function migrateDistributors(rows, migratedIds, errors, summary) {
  for (const row of rows) {
    try {
      const { data: existing } = await supabaseAdmin
        .from('core_distributors')
        .select('distributor_id')
        .eq('distributor_name', row.distributor_name)
        .maybeSingle();

      if (existing) {
        const updateData = {};
        if (row.distributor_url && !existing.distributor_url) updateData.distributor_url = row.distributor_url;
        if (row.distributor_logo_url && !existing.distributor_logo_url) updateData.distributor_logo_url = row.distributor_logo_url;

        if (Object.keys(updateData).length > 0) {
          await supabaseAdmin
            .from('core_distributors')
            .update(updateData)
            .eq('distributor_id', existing.distributor_id);
          summary.distributorsUpdated++;
        }
      } else {
        const { error: createError } = await supabaseAdmin
          .from('core_distributors')
          .insert({
            distributor_name: row.distributor_name,
            distributor_url: row.distributor_url || null,
            distributor_logo_url: row.distributor_logo_url || null
          });
        if (createError) throw createError;
        summary.distributorsCreated++;
      }

      migratedIds.push(row.staging_id);
    } catch (error) {
      errors.push(`Row ${row.row_index + 1}: ${error.message}`);
    }
  }
}

async function migrateSupplierPortfolio(rows, migratedIds, errors, summary) {
  // Fetch categories and sub-categories
  const { data: categoriesData } = await supabaseAdmin
    .from('categories')
    .select('category_id, category_name');
  
  const { data: subCategoriesData } = await supabaseAdmin
    .from('sub_categories')
    .select('sub_category_id, sub_category_name');
  
  // Create mutable copies
  let categories = categoriesData ? [...categoriesData] : [];
  let subCategories = subCategoriesData ? [...subCategoriesData] : [];

  for (const row of rows) {
    try {
      // Get or create supplier
      let { data: supplier } = await supabaseAdmin
        .from('core_suppliers')
        .select('supplier_id')
        .eq('supplier_name', row.supplier_name)
        .maybeSingle();

      if (!supplier) {
        const { data: newSupplier, error: supplierError } = await supabaseAdmin
          .from('core_suppliers')
          .insert({
            supplier_name: row.supplier_name,
            supplier_url: row.supplier_url || null,
            supplier_logo_url: row.supplier_logo_url || null
          })
          .select()
          .single();
        if (supplierError) throw supplierError;
        supplier = newSupplier;
        summary.suppliersCreated++;
      } else {
        summary.suppliersUpdated++;
      }

      // Get or create brand
      let { data: brand } = await supabaseAdmin
        .from('core_brands')
        .select('brand_id')
        .eq('brand_name', row.brand_name)
        .maybeSingle();

      if (!brand) {
        const { data: newBrand, error: brandError } = await supabaseAdmin
          .from('core_brands')
          .insert({
            brand_name: row.brand_name,
            brand_url: row.brand_url || null,
            brand_logo_url: row.brand_logo_url || null,
            data_source: 'csv_import'
          })
          .select()
          .single();
        if (brandError) throw brandError;
        brand = newBrand;
        summary.brandsCreated++;
      } else {
        summary.brandsUpdated++;
      }

      // Create brand_supplier relationship
      const { error: relError } = await supabaseAdmin
        .from('brand_supplier')
        .upsert({
          brand_id: brand.brand_id,
          supplier_id: supplier.supplier_id,
          relationship_source: 'csv_import'
        }, { onConflict: 'brand_id,supplier_id' });

      if (!relError) summary.relationshipsCreated++;

      // Process categories and sub-categories for brand
      if (row.brand_categories && brand.brand_id) {
        const categoriesArray = row.brand_categories.split(',').map(c => c.trim()).filter(Boolean);
        for (const catName of categoriesArray) {
          let category = categories?.find(c => c.category_name.toLowerCase() === catName.toLowerCase());
          
          // Create category if it doesn't exist
          if (!category) {
            const { data: newCategory, error: createError } = await supabaseAdmin
              .from('categories')
              .insert({ category_name: catName })
              .select()
              .single();
            if (!createError && newCategory) {
              category = newCategory;
              categories.push(category);
            }
          }
          
          if (category) {
            const { error: linkError } = await supabaseAdmin
              .from('brand_categories')
              .upsert({ brand_id: brand.brand_id, category_id: category.category_id }, { onConflict: 'brand_id,category_id' });
            if (!linkError) summary.categoriesLinked++;
          }
        }
      }

      if (row.brand_sub_categories && brand.brand_id) {
        const subCategoriesArray = row.brand_sub_categories.split(',').map(c => c.trim()).filter(Boolean);
        for (const subCatName of subCategoriesArray) {
          let subCategory = subCategories?.find(sc => sc.sub_category_name.toLowerCase() === subCatName.toLowerCase());
          
          // Create sub-category if it doesn't exist
          if (!subCategory) {
            const { data: brandCategories } = await supabaseAdmin
              .from('brand_categories')
              .select('category_id')
              .eq('brand_id', brand.brand_id)
              .limit(1);
            
            const categoryId = brandCategories?.[0]?.category_id || categories?.[0]?.category_id;
            
            if (categoryId) {
              const { data: newSubCategory, error: createError } = await supabaseAdmin
                .from('sub_categories')
                .insert({ 
                  sub_category_name: subCatName,
                  category_id: categoryId
                })
                .select()
                .single();
              if (!createError && newSubCategory) {
                subCategory = newSubCategory;
                subCategories.push(subCategory);
              }
            }
          }
          
          if (subCategory) {
            const { error: linkError } = await supabaseAdmin
              .from('brand_sub_categories')
              .upsert({ brand_id: brand.brand_id, sub_category_id: subCategory.sub_category_id }, { onConflict: 'brand_id,sub_category_id' });
            if (!linkError) summary.subCategoriesLinked++;
          }
        }
      }

      migratedIds.push(row.staging_id);
    } catch (error) {
      errors.push(`Row ${row.row_index + 1}: ${error.message}`);
    }
  }
}

async function migrateDistributorPortfolio(rows, migratedIds, errors, summary) {
  // Fetch states
  const { data: states } = await supabaseAdmin
    .from('core_states')
    .select('state_id, state_code, state_name');

  for (const row of rows) {
    try {
      // Get or create distributor
      let { data: distributor } = await supabaseAdmin
        .from('core_distributors')
        .select('distributor_id')
        .eq('distributor_name', row.distributor_name)
        .maybeSingle();

      if (!distributor) {
        const { data: newDistributor, error: distributorError } = await supabaseAdmin
          .from('core_distributors')
          .insert({
            distributor_name: row.distributor_name,
            distributor_url: row.distributor_url || null,
            distributor_logo_url: row.distributor_logo_url || null
          })
          .select()
          .single();
        if (distributorError) throw distributorError;
        distributor = newDistributor;
        summary.distributorsCreated++;
      } else {
        summary.distributorsUpdated++;
      }

      // Get or create supplier
      let { data: supplier } = await supabaseAdmin
        .from('core_suppliers')
        .select('supplier_id')
        .eq('supplier_name', row.supplier_name)
        .maybeSingle();

      if (!supplier) {
        const { data: newSupplier, error: supplierError } = await supabaseAdmin
          .from('core_suppliers')
          .insert({
            supplier_name: row.supplier_name,
            supplier_url: row.supplier_url || null,
            supplier_logo_url: row.supplier_logo_url || null
          })
          .select()
          .single();
        if (supplierError) throw supplierError;
        supplier = newSupplier;
        summary.suppliersCreated++;
      } else {
        summary.suppliersUpdated++;
      }

      // Find state
      let stateId = null;
      if (row.state_code) {
        const state = states?.find(s => s.state_code?.toLowerCase() === row.state_code.toLowerCase());
        if (state) stateId = state.state_id;
      } else if (row.state_name) {
        const state = states?.find(s => s.state_name?.toLowerCase() === row.state_name.toLowerCase());
        if (state) stateId = state.state_id;
      }

      if (!stateId) {
        throw new Error(`State not found: ${row.state_code || row.state_name}`);
      }

      // Create distributor_supplier_state relationship
      const { error: relError } = await supabaseAdmin
        .from('distributor_supplier_state')
        .upsert({
          distributor_id: distributor.distributor_id,
          supplier_id: supplier.supplier_id,
          state_id: stateId,
          is_verified: false
        }, { onConflict: 'distributor_id,supplier_id,state_id' });

      if (!relError) summary.relationshipsCreated++;

      migratedIds.push(row.staging_id);
    } catch (error) {
      errors.push(`Row ${row.row_index + 1}: ${error.message}`);
    }
  }
}
