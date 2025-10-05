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

  useEffect(() => {
    async function fetchBrands() {
      const { data, error } = await supabase
        .from('core_brands')
        .select(`
          id,
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

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Brands</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f1f5f9' }}>
          <tr>
            <th>Logo</th>
            <th>Brand Name</th>
            <th>Website</th>
            <th>Categories</th>
            <th>Sub-Categories</th>
            <th>Data Source</th>
          </tr>
        </thead>
        <tbody>
          {brands.map((brand) => (
            <tr key={brand.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td>
                {brand.brand_logo_url ? (
                  <img
                    src={brand.brand_logo_url}
                    alt={brand.brand_name}
                    style={{ width: 40, height: 40, objectFit: 'contain' }}
                  />
                ) : (
                  '—'
                )}
              </td>
              <td>{brand.brand_name}</td>
              <td>
                {brand.brand_url ? (
                  <a href={brand.brand_url} target="_blank" rel="noopener noreferrer">
                    {brand.brand_url}
                  </a>
                ) : (
                  '—'
                )}
              </td>
              <td>
                {brand.brand_categories?.map((bc) => bc.categories.category_name).join(', ') || '—'}
              </td>
              <td>
                {brand.brand_sub_categories
                  ?.map((bsc) => bsc.sub_categories.sub_category_name)
                  .join(', ') || '—'}
              </td>
              <td>{brand.data_source || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}