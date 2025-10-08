'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender
} from '@tanstack/react-table';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState([]);

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

      if (error) {
        console.error('Supabase error:', error);
      } else {
        console.log('Brands data:', data);
        setBrands(data || []);
      }
      setLoading(false);
    }
    fetchBrands();
  }, []);

  const columns = [
    {
      accessorKey: 'brand_name',
      header: 'Brand Name'
    },
    {
      accessorKey: 'brand_categories',
      header: 'Categories',
      cell: info =>
        Array.isArray(info.getValue())
          ? info
              .getValue()
              .map(c => c?.categories?.category_name)
              .filter(Boolean)
              .join(', ')
          : '—'
    },
    {
      accessorKey: 'brand_sub_categories',
      header: 'Sub-Categories',
      cell: info =>
        Array.isArray(info.getValue())
          ? info
              .getValue()
              .map(s => s?.sub_categories?.sub_category_name)
              .filter(Boolean)
              .join(', ')
          : '—'
    },
    {
      accessorKey: 'data_source',
      header: 'Data Source'
    },
    {
      accessorKey: 'brand_url',
      header: 'Website',
      cell: info => info.getValue() || '—'
    },
    {
      accessorKey: 'brand_logo_url',
      header: 'Logo URL',
      cell: info => info.getValue() || '—'
    }
  ];

  const table = useReactTable({
    data: brands,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20, overflowX: 'auto' }}>
      <h1>Brands</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f1f5f9' }}>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderBottom: '2px solid #e2e8f0',
                    minWidth: 150,
                    userSelect: 'none'
                  }}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                  {{
                    asc: ' 🔼',
                    desc: ' 🔽'
                  }[header.column.getIsSorted()] ?? null}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #f1f5f9',
                    whiteSpace: 'nowrap'
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