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

  // Fetch brands
  useEffect(() => {
    async function fetchBrands() {
      const { data, error } = await supabase
        .from('core_brands')
        .select(`
          brand_id,
          brand_name,
          brand_url,
          brand_logo_url,
          data_source,
          brand_categories (categories (category_name)),
          brand_sub_categories (sub_categories (sub_category_name))
        `);
      if (error) console.error('Supabase error:', error);
      else setBrands(data || []);
      setLoading(false);
    }
    fetchBrands();
  }, []);

  // --- Resizing logic (with overlay grab zone)
  const startResize = (e, key) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const th = e.target.closest('th');
    const startWidth = th.offsetWidth;

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX)); // ✅ minWidth = 60
      setColWidths((prev) => {
        const updated = { ...prev, [key]: newWidth };
        localStorage.setItem('brandColWidths', JSON.stringify(updated));
        return updated;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const autoFitColumn = (key) => {
    const table = document.querySelector('table');
    if (!table) return;

    const index = columns.findIndex((c) => c.key === key) + 1;
    const cells = Array.from(table.querySelectorAll(`td:nth-child(${index})`));
    const header = table.querySelector(`th:nth-child(${index})`);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = getComputedStyle(table).font;

    const maxWidth = Math.max(
      ...cells.map((cell) => ctx.measureText(cell.innerText).width + 40),
      ctx.measureText(header.innerText).width + 60
    );

    setColWidths((prev) => {
      const updated = { ...prev, [key]: Math.min(maxWidth, 600) };
      localStorage.setItem('brandColWidths', JSON.stringify(updated));
      return updated;
    });
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
    { key: 'brand_categories', label: 'Categories' },
    { key: 'brand_sub_categories', label: 'Sub-Categories' },
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
            tableLayout: 'fixed', // ✅ fixed layout allows shrink
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
                    userSelect: 'none',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    overflow: 'hidden', // ✅ prevent stretching
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortConfig.key === col.key && (
                    <span style={{ marginLeft: 4 }}>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                  <span
                    onMouseDown={(e) => startResize(e, col.key)}
                    onDoubleClick={() => autoFitColumn(col.key)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      height: '100%',
                      width: '8px',
                      cursor: 'col-resize',
                      zIndex: 10,
                      userSelect: 'none',
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

                  if (col.key === 'brand_categories') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        {b.brand_categories?.map((c) => c?.categories?.category_name).join(', ') ||
                          '—'}
                      </td>
                    );
                  }

                  if (col.key === 'brand_sub_categories') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        {b.brand_sub_categories
                          ?.map((s) => s?.sub_categories?.sub_category_name)
                          .join(', ') || '—'}
                      </td>
                    );
                  }

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

// --- Shared cell style
const cellStyle = {
  padding: '8px 12px',
  borderBottom: '1px solid #f1f5f9',
  overflow: 'hidden',
  textOverflow: 'ellipsis', // ✅ truncates text
  whiteSpace: 'nowrap',
  maxWidth: '600px',
};

// --- Inline editable cell
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
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      />
    );

  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        cursor: 'text',
        minWidth: 80,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      title={value || 'Click to edit'}
    >
      {value || '—'}
    </div>
  );
}