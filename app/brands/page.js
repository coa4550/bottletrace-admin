'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchBrands() {
    setLoading(true);
    const { data, error } = await supabase
      .from('core_brands')
      .select(`
        brand_id,
        brand_name,
        brand_url,
        brand_logo_url,
        data_source,
        brand_categories (
          core_categories (category_name)
        ),
        brand_sub_categories (
          core_sub_categories (sub_category_name)
        )
      `)
      .order('brand_name', { ascending: true });

    if (error) console.error('Supabase error:', error);
    else setBrands(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchBrands();
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>Brands</h1>

      {loading ? (
        <p>Loading brands...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Logo</th>
              <th style={{ padding: 8 }}>Brand Name</th>
              <th style={{ padding: 8 }}>Website</th>
              <th style={{ padding: 8 }}>Categories</th>
              <th style={{ padding: 8 }}>Sub-Categories</th>
              <th style={{ padding: 8 }}>Data Source</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.brand_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: 8 }}>
                  {b.brand_logo_url ? (
                    <img src={b.brand_logo_url} alt={b.brand_name} style={{ height: 40 }} />
                  ) : (
                    <span style={{ color: '#94a3b8' }}>No logo</span>
                  )}
                </td>
                <td style={{ padding: 8 }}>{b.brand_name}</td>
                <td style={{ padding: 8 }}>
                  {b.brand_url ? (
                    <a href={b.brand_url} target="_blank" rel="noreferrer">
                      {b.brand_url.replace(/^https?:\/\//, '')}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: 8 }}>
                  {b.brand_categories?.length
                    ? b.brand_categories
                        .map((c) => c.core_categories?.category_name)
                        .filter(Boolean)
                        .join(', ')
                    : '—'}
                </td>
                <td style={{ padding: 8 }}>
                  {b.brand_sub_categories?.length
                    ? b.brand_sub_categories
                        .map((s) => s.core_sub_categories?.sub_category_name)
                        .filter(Boolean)
                        .join(', ')
                    : '—'}
                </td>
                <td style={{ padding: 8 }}>{b.data_source || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}