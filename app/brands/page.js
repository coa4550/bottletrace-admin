'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colWidths, setColWidths] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('brandColWidths');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Fetch brands with categories and sub-categories
  useEffect(() => {
    async function fetchBrands() {
      try {
        // Fetch ALL brands using pagination
        let allBrands = [];
        let start = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('core_brands')
            .select('*')
            .order('brand_name')
            .range(start, start + pageSize - 1);

          if (error) throw error;
          
          if (data && data.length > 0) {
            allBrands = [...allBrands, ...data];
            start += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Fetch ALL brand-category mappings
        let allBrandCats = [];
        start = 0;
        hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('brand_categories')
            .select('brand_id, categories(category_name)')
            .range(start, start + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allBrandCats = [...allBrandCats, ...data];
            start += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Fetch ALL brand-subcategory mappings
        let allBrandSubcats = [];
        start = 0;
        hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('brand_sub_categories')
            .select('brand_id, sub_categories(sub_category_name)')
            .range(start, start + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allBrandSubcats = [...allBrandSubcats, ...data];
            start += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Fetch ALL brand-supplier relationships for verification data
        let allBrandSuppliers = [];
        start = 0;
        hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('brand_supplier')
            .select('brand_id, is_verified, last_verified_at')
            .range(start, start + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allBrandSuppliers = [...allBrandSuppliers, ...data];
            start += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Create lookup maps
        const catsMap = {};
        allBrandCats?.forEach(bc => {
          if (bc.categories && bc.categories.category_name) {
            if (!catsMap[bc.brand_id]) catsMap[bc.brand_id] = [];
            catsMap[bc.brand_id].push(bc.categories.category_name);
          }
        });

        const subcatsMap = {};
        allBrandSubcats?.forEach(bsc => {
          if (bsc.sub_categories && bsc.sub_categories.sub_category_name) {
            if (!subcatsMap[bsc.brand_id]) subcatsMap[bsc.brand_id] = [];
            subcatsMap[bsc.brand_id].push(bsc.sub_categories.sub_category_name);
          }
        });

        // Create verification lookup map
        // For each brand, determine if ANY supplier relationship is verified
        // and find the most recent verification date
        const verificationMap = {};
        allBrandSuppliers?.forEach(bs => {
          if (!verificationMap[bs.brand_id]) {
            verificationMap[bs.brand_id] = {
              hasVerified: false,
              lastVerifiedAt: null
            };
          }
          
          if (bs.is_verified) {
            verificationMap[bs.brand_id].hasVerified = true;
          }
          
          if (bs.last_verified_at) {
            const verifiedDate = new Date(bs.last_verified_at);
            if (!verificationMap[bs.brand_id].lastVerifiedAt || 
                verifiedDate > new Date(verificationMap[bs.brand_id].lastVerifiedAt)) {
              verificationMap[bs.brand_id].lastVerifiedAt = bs.last_verified_at;
            }
          }
        });

        // Merge data
        const enrichedBrands = allBrands.map(brand => ({
          ...brand,
          categories: catsMap[brand.brand_id]?.join(', ') || '',
          sub_categories: subcatsMap[brand.brand_id]?.join(', ') || '',
          is_verified: verificationMap[brand.brand_id]?.hasVerified || false,
          last_verified_at: verificationMap[brand.brand_id]?.lastVerifiedAt || null
        }));

        setBrands(enrichedBrands);
      } catch (error) {
        console.error('Error fetching brands:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchBrands();
  }, []);

  const startResize = (e, key) => {
    const startX = e.clientX;
    const startWidth = colWidths[key] || 150;

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(60, startWidth + moveEvent.clientX - startX);
      setColWidths((prev) => {
        const updated = { ...prev, [key]: newWidth };
        localStorage.setItem('brandColWidths', JSON.stringify(updated));
        return updated;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleEdit = async (brandId, field, newValue) => {
    try {
      const { error } = await supabase
        .from('core_brands')
        .update({ [field]: newValue })
        .eq('brand_id', brandId);

      if (error) throw error;
      setBrands((prev) =>
        prev.map((b) => (b.brand_id === brandId ? { ...b, [field]: newValue } : b))
      );
    } catch (err) {
      console.error('Update error:', err.message);
      alert('Failed to update Supabase.');
    }
  };

  const handleCategoriesEdit = async (brandId, newValue) => {
    try {
      // Parse comma-separated category names
      const categoryNames = newValue
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

      // Get or create categories
      const categoryIds = [];
      for (const name of categoryNames) {
        // Try to find existing category
        let { data: existing, error: findError } = await supabase
          .from('categories')
          .select('category_id')
          .eq('category_name', name)
          .maybeSingle();

        if (findError) throw findError;

        if (existing) {
          categoryIds.push(existing.category_id);
        } else {
          // Create new category
          const { data: created, error: createError } = await supabase
            .from('categories')
            .insert({ category_name: name })
            .select('category_id')
            .single();

          if (createError) throw createError;
          categoryIds.push(created.category_id);
        }
      }

      // Delete existing brand-category relationships
      const { error: deleteError } = await supabase
        .from('brand_categories')
        .delete()
        .eq('brand_id', brandId);

      if (deleteError) throw deleteError;

      // Insert new relationships
      if (categoryIds.length > 0) {
        const relationships = categoryIds.map(categoryId => ({
          brand_id: brandId,
          category_id: categoryId
        }));

        const { error: insertError } = await supabase
          .from('brand_categories')
          .insert(relationships);

        if (insertError) throw insertError;
      }

      // Update local state
      setBrands((prev) =>
        prev.map((b) => (b.brand_id === brandId ? { ...b, categories: newValue } : b))
      );
    } catch (err) {
      console.error('Update categories error:', err.message);
      alert('Failed to update categories: ' + err.message);
    }
  };

  const handleSubCategoriesEdit = async (brandId, newValue) => {
    try {
      // Parse comma-separated sub-category names
      const subCategoryNames = newValue
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

      // Get or create sub-categories
      const subCategoryIds = [];
      for (const name of subCategoryNames) {
        // Try to find existing sub-category
        let { data: existing, error: findError } = await supabase
          .from('sub_categories')
          .select('sub_category_id')
          .eq('sub_category_name', name)
          .maybeSingle();

        if (findError) throw findError;

        if (existing) {
          subCategoryIds.push(existing.sub_category_id);
        } else {
          // Create new sub-category
          const { data: created, error: createError } = await supabase
            .from('sub_categories')
            .insert({ sub_category_name: name })
            .select('sub_category_id')
            .single();

          if (createError) throw createError;
          subCategoryIds.push(created.sub_category_id);
        }
      }

      // Delete existing brand-subcategory relationships
      const { error: deleteError } = await supabase
        .from('brand_sub_categories')
        .delete()
        .eq('brand_id', brandId);

      if (deleteError) throw deleteError;

      // Insert new relationships
      if (subCategoryIds.length > 0) {
        const relationships = subCategoryIds.map(subCategoryId => ({
          brand_id: brandId,
          sub_category_id: subCategoryId
        }));

        const { error: insertError } = await supabase
          .from('brand_sub_categories')
          .insert(relationships);

        if (insertError) throw insertError;
      }

      // Update local state
      setBrands((prev) =>
        prev.map((b) => (b.brand_id === brandId ? { ...b, sub_categories: newValue } : b))
      );
    } catch (err) {
      console.error('Update sub-categories error:', err.message);
      alert('Failed to update sub-categories: ' + err.message);
    }
  };

  const columns = [
    { key: 'brand_name', label: 'Brand Name', editable: true },
    { key: 'categories', label: 'Categories', editable: true, editHandler: 'categories' },
    { key: 'sub_categories', label: 'Sub-Categories', editable: true, editHandler: 'sub_categories' },
    { key: 'is_verified', label: 'Verified' },
    { key: 'last_verified_at', label: 'Verified Date' },
    { key: 'data_source', label: 'Data Source', editable: true },
    { key: 'brand_url', label: 'Website', editable: true },
    { key: 'brand_logo_url', label: 'Logo URL', editable: true },
  ];

  const sortedBrands = [...brands].sort((a, b) => {
    const { key, direction } = sortConfig;
    if (!key) return 0;
    const aVal = a[key] ?? '';
    const bVal = b[key] ?? '';
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key)
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: 'asc' };
    });
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Brands ({brands.length})</h1>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            tableLayout: 'auto',
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          <thead style={{ background: '#f1f5f9' }}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: colWidths[col.key] || 150,
                    position: 'relative',
                    borderRight: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortConfig.key === col.key && (
                    <span style={{ marginLeft: 4 }}>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                  <div
                    onMouseDown={(e) => startResize(e, col.key)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      height: '100%',
                      width: '5px',
                      cursor: 'col-resize',
                      background: 'transparent',
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedBrands.map((b) => (
              <tr key={b.brand_id}>
                {columns.map((col) => {
                  const value = b[col.key];
                  const editable = col.editable;

                  // Special rendering for verified status
                  if (col.key === 'is_verified') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        {value ? (
                          <span style={{ color: '#10b981', fontWeight: 500 }}>✓ Verified</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                    );
                  }

                  // Special rendering for verified date
                  if (col.key === 'last_verified_at') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        {value ? (
                          <span>{new Date(value).toLocaleDateString()}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                    );
                  }

                  if (editable) {
                    // Use special handler for categories and sub-categories
                    const handleChange = col.editHandler === 'categories'
                      ? (val) => handleCategoriesEdit(b.brand_id, val)
                      : col.editHandler === 'sub_categories'
                      ? (val) => handleSubCategoriesEdit(b.brand_id, val)
                      : (val) => handleEdit(b.brand_id, col.key, val);

                    return (
                      <td key={col.key} style={cellStyle}>
                        <EditableCell
                          value={value}
                          onChange={handleChange}
                        />
                      </td>
                    );
                  }

                  return (
                    <td key={col.key} style={cellStyle}>
                      {value || '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellStyle = {
  padding: '8px 12px',
  borderBottom: '1px solid #f1f5f9',
  whiteSpace: 'nowrap',
  maxWidth: 400,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function EditableCell({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value || '');

  const handleBlur = () => {
    setEditing(false);
    if (temp !== value) onChange(temp);
  };

  if (editing)
    return (
      <input
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={handleBlur}
        autoFocus
        style={{
          width: '100%',
          padding: 4,
          border: '1px solid #cbd5e1',
          borderRadius: 4,
        }}
      />
    );

  return (
    <div
      onClick={() => setEditing(true)}
      style={{ cursor: 'text', minWidth: 80 }}
      title="Click to edit"
    >
      {value || '—'}
    </div>
  );
}