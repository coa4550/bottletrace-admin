import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { rows, confirmedMatches, fileName, isFirstBatch, isLastBatch, existingImportLogId } = await req.json();
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    let importLogId = existingImportLogId;

    // Create import log on first batch
    if (isFirstBatch && !importLogId) {
      const { data: logData, error: logError } = await supabaseAdmin
        .from('import_logs')
        .insert({
          import_type: 'brand',
          file_name: fileName || 'unknown.csv',
          status: 'in_progress',
          rows_processed: 0
        })
        .select()
        .single();

      if (logError) throw logError;
      importLogId = logData.import_log_id;
    }

    let brandsCreated = 0;
    let brandsUpdated = 0;
    let categoriesLinked = 0;
    let subCategoriesLinked = 0;
    let skipped = 0;
    const errors = [];

    // Fetch all categories and sub-categories
    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('category_id, category_name');
    
    const { data: subCategories } = await supabaseAdmin
      .from('sub_categories')
      .select('sub_category_id, sub_category_name');

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const match = confirmedMatches?.[i];
      
      try {
        const brandName = (row.brand_name || '').trim();
        
        if (!brandName) {
          skipped++;
          continue;
        }

        const brandUrl = (row.brand_url || '').trim();
        const brandLogoUrl = (row.brand_logo_url || '').trim();
        const dataSource = (row.data_source || 'csv_import').trim();

        let brandId;
        let wasCreated = false;
        let wasUpdated = false;

        // Check if user wants to use existing brand or create new
        if (match?.useExisting && match?.existingBrandId) {
          // Use existing brand - update it
          brandId = match.existingBrandId;
          
          // Update brand details if provided
          const updateData = {};
          if (brandUrl) updateData.brand_url = brandUrl;
          if (brandLogoUrl) updateData.brand_logo_url = brandLogoUrl;
          if (dataSource) updateData.data_source = dataSource;

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabaseAdmin
              .from('core_brands')
              .update(updateData)
              .eq('brand_id', brandId);

            if (updateError) throw updateError;
            wasUpdated = true;
            brandsUpdated++;
          }

          // Log the update
          await supabaseAdmin
            .from('import_changes')
            .insert({
              import_log_id: importLogId,
              change_type: 'updated',
              entity_type: 'brand',
              entity_id: brandId,
              entity_name: brandName,
              old_value: match.existingBrandName ? { brand_name: match.existingBrandName } : null,
              new_value: { 
                brand_name: brandName,
                brand_url: brandUrl,
                brand_logo_url: brandLogoUrl,
                data_source: dataSource
              },
              source_row: row
            });

        } else {
          // Create new brand
          const { data: newBrand, error: brandError } = await supabaseAdmin
            .from('core_brands')
            .insert({
              brand_name: brandName,
              brand_url: brandUrl || null,
              brand_logo_url: brandLogoUrl || null,
              data_source: dataSource
            })
            .select()
            .single();

          if (brandError) {
            // Check if it's a duplicate error
            if (brandError.code === '23505') {
              // Brand already exists, fetch it
              const { data: existingBrand } = await supabaseAdmin
                .from('core_brands')
                .select('brand_id')
                .eq('brand_name', brandName)
                .single();
              
              if (existingBrand) {
                brandId = existingBrand.brand_id;
                skipped++;
              } else {
                throw brandError;
              }
            } else {
              throw brandError;
            }
          } else {
            brandId = newBrand.brand_id;
            wasCreated = true;
            brandsCreated++;

            // Log the creation
            await supabaseAdmin
              .from('import_changes')
              .insert({
                import_log_id: importLogId,
                change_type: 'created',
                entity_type: 'brand',
                entity_id: brandId,
                entity_name: brandName,
                new_value: { 
                  brand_name: brandName,
                  brand_url: brandUrl,
                  brand_logo_url: brandLogoUrl,
                  data_source: dataSource
                },
                source_row: row
              });
          }
        }

        // Process categories
        if (brandId) {
          const categoriesArray = (row.brand_categories || '')
            .split(',')
            .map(c => c.trim())
            .filter(Boolean);

          for (const categoryName of categoriesArray) {
            const category = categories?.find(c => 
              c.category_name.toLowerCase() === categoryName.toLowerCase()
            );

            if (category) {
              // Check if relationship exists
              const { data: existing } = await supabaseAdmin
                .from('brand_categories')
                .select('*')
                .eq('brand_id', brandId)
                .eq('category_id', category.category_id)
                .single();

              if (!existing) {
                const { error: catError } = await supabaseAdmin
                  .from('brand_categories')
                  .insert({
                    brand_id: brandId,
                    category_id: category.category_id
                  });

                if (!catError) {
                  categoriesLinked++;
                  
                  await supabaseAdmin
                    .from('import_changes')
                    .insert({
                      import_log_id: importLogId,
                      change_type: 'linked',
                      entity_type: 'brand_category',
                      entity_id: brandId,
                      entity_name: `${brandName} → ${categoryName}`,
                      new_value: { category_name: categoryName },
                      source_row: row
                    });
                }
              }
            }
          }

          // Process sub-categories
          const subCategoriesArray = (row.brand_sub_categories || '')
            .split(',')
            .map(c => c.trim())
            .filter(Boolean);

          for (const subCategoryName of subCategoriesArray) {
            const subCategory = subCategories?.find(sc => 
              sc.sub_category_name.toLowerCase() === subCategoryName.toLowerCase()
            );

            if (subCategory) {
              // Check if relationship exists
              const { data: existing } = await supabaseAdmin
                .from('brand_sub_categories')
                .select('*')
                .eq('brand_id', brandId)
                .eq('sub_category_id', subCategory.sub_category_id)
                .single();

              if (!existing) {
                const { error: subCatError } = await supabaseAdmin
                  .from('brand_sub_categories')
                  .insert({
                    brand_id: brandId,
                    sub_category_id: subCategory.sub_category_id
                  });

                if (!subCatError) {
                  subCategoriesLinked++;
                  
                  await supabaseAdmin
                    .from('import_changes')
                    .insert({
                      import_log_id: importLogId,
                      change_type: 'linked',
                      entity_type: 'brand_sub_category',
                      entity_id: brandId,
                      entity_name: `${brandName} → ${subCategoryName}`,
                      new_value: { sub_category_name: subCategoryName },
                      source_row: row
                    });
                }
              }
            }
          }
        }

      } catch (error) {
        console.error(`Error processing row ${i}:`, error);
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    // Update import log on last batch
    if (isLastBatch && importLogId) {
      const { error: updateLogError } = await supabaseAdmin
        .from('import_logs')
        .update({
          status: 'completed',
          brands_created: brandsCreated,
          rows_processed: rows.length,
          rows_skipped: skipped,
          errors_count: errors.length
        })
        .eq('import_log_id', importLogId);

      if (updateLogError) console.error('Error updating import log:', updateLogError);
    }

    return NextResponse.json({
      success: true,
      brandsCreated,
      brandsUpdated,
      categoriesLinked,
      subCategoriesLinked,
      skipped,
      errors,
      importLogId
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

