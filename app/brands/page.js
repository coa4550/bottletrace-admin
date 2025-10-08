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
        // Fetch all brands
        const { data: brandsData, error: brandsError } = await supabase
          .from('core_brands')
          .select('*')
          .order('brand_name');

        if (brandsError) throw brandsError;

        // Fetch brand-category mappings
        const { data: brandCats, error: catsError } = await supabase
          .from('brand_categories')
          .select('brand_id, categories(category_name)');

        if (catsError) {
          console.error('Categories error:', catsError);
        } else {
          console.log('Brand categories data:', brandCats);
        }

        // Fetch brand-subcategory mappings
        const { data: brandSubcats, error: subcatsError } = await supabase
          .from('brand_sub_categories')
          .select('brand_id, sub_categories(sub_category_name)');

        if (subcatsError) {
          console.error('Sub-categories error:', subcatsError);
        } else {
          console.log('Brand sub-categories data:', brandSubcats);
        }

        // Create lookup maps
        const catsMap = {};
        brandCats?.forEach(bc => {
          if (bc.categories && bc.categories.category_name) {
            if (!catsMap[bc.brand_id]) catsMap[bc.brand_id] = [];
            catsMap[bc.brand_id].push(bc.categories.category_name);
          }
        });

        const subcatsMap = {};
        brandSubcats?.forEach(bsc => {
          if (bsc.sub_categories && bsc.sub_categories.sub_category_name) {
            if (!subcatsMap[bsc.brand_id]) subcatsMap[bsc.brand_id] = [];
            subcatsMap[bsc.brand_id].push(bsc.sub_categories.sub_category_name);
          }
        });

        // Merge data
        const enrichedBrands = brandsData.map(brand => ({
          ...brand,
          categories: catsMap[brand.brand_id]?.join(', ') || '',
          sub_categories: subcatsMap[brand.brand_id]?.join(', ') || ''
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

  const columns = [
    { key: 'brand_name', label: 'Brand Name', editable: true },
    { key: 'categories', label: 'Categories' },
    { key: 'sub_categories', label: 'Sub-Categories' },
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
      <h1>Brands</h1>
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

                  if (editable)
                    return (
                      <td key={col.key} style={cellStyle}>
                        <EditableCell
                          value={value}
                          onChange={(val) => handleEdit(b.brand_id, col.key, val)}
                        />
                      </td>
                    );

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