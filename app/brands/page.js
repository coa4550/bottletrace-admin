'use client';
import 'react-resizable/css/styles.css';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState([]);
  const [columnWidths, setColumnWidths] = useState({});

  // --- Load saved column widths from localStorage ---
  useEffect(() => {
    const saved = localStorage.getItem('brandTableColumnWidths');
    if (saved) setColumnWidths(JSON.parse(saved));
  }, []);

  // --- Save widths to localStorage whenever they change ---
  useEffect(() => {
    localStorage.setItem('brandTableColumnWidths', JSON.stringify(columnWidths));
  }, [columnWidths]);

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
          brand_categories (
            categories (category_name)
          ),
          brand_sub_categories (
            sub_categories (sub_category_name)
          )
        `);

      if (error) console.error('Supabase error:', error);
      else setBrands(data || []);
      setLoading(false);
    }
    fetchBrands();
  }, []);

  const handleResize = (columnId) => (e, { size }) => {
    setColumnWidths((old) => ({ ...old, [columnId]: size.width }));
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
    {
      accessorKey: 'brand_name',
      header: 'Brand Name',
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          onChange={(val) => handleEdit(row.original.brand_id, 'brand_name', val)}
        />
      ),
    },
    {
      accessorKey: 'brand_categories',
      header: 'Categories',
      cell: (info) =>
        Array.isArray(info.getValue())
          ? info
              .getValue()
              .map((c) => c?.categories?.category_name)
              .filter(Boolean)
              .join(', ')
          : '—',
    },
    {
      accessorKey: 'brand_sub_categories',
      header: 'Sub-Categories',
      cell: (info) =>
        Array.isArray(info.getValue())
          ? info
              .getValue()
              .map((s) => s?.sub_categories?.sub_category_name)
              .filter(Boolean)
              .join(', ')
          : '—',
    },
    {
      accessorKey: 'data_source',
      header: 'Data Source',
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          onChange={(val) => handleEdit(row.original.brand_id, 'data_source', val)}
        />
      ),
    },
    {
      accessorKey: 'brand_url',
      header: 'Website',
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          onChange={(val) => handleEdit(row.original.brand_id, 'brand_url', val)}
        />
      ),
    },
    {
      accessorKey: 'brand_logo_url',
      header: 'Logo URL',
      cell: ({ row, getValue }) => (
        <EditableCell
          value={getValue()}
          onChange={(val) => handleEdit(row.original.brand_id, 'brand_logo_url', val)}
        />
      ),
    },
  ];

  const table = useReactTable({
    data: brands,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20, overflowX: 'auto' }}>
      <h1>Brands</h1>
      <table
  style={{
    borderCollapse: 'collapse',
    tableLayout: 'auto',
    width: 'max-content',
    minWidth: '100%'
  }}
>
       <thead style={{ background: '#f1f5f9' }}>
  <tr>
    {[
      'Brand Name',
      'Categories',
      'Sub-Categories',
      'Data Source',
      'Website',
      'Logo URL'
    ].map((heading) => (
      <th
        key={heading}
        style={{
          resize: 'horizontal',
          overflow: 'auto',
          minWidth: '120px',
          maxWidth: '600px',
          borderBottom: '2px solid #e2e8f0',
          padding: '8px 12px',
          background: '#f8fafc',
          textAlign: 'left',
          userSelect: 'none'
        }}
      >
        {heading}
      </th>
    ))}
  </tr>
</thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #f1f5f9',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 🔹 Editable cell component
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
    <div onClick={() => setEditing(true)} style={{ cursor: 'text' }}>
      {value || '—'}
    </div>
  );
}