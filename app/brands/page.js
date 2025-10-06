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
        {/* ✅ Safe render: prevents crash on null category/subcategory */}
<tbody>
  {brands.map((brand) => (
    <tr key={brand.brand_id}>
      <td>{brand.brand_name || "—"}</td>
      <td>
        {brand.brand_url ? (
          <a
            href={brand.brand_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#2563eb", textDecoration: "underline" }}
          >
            {brand.brand_url}
          </a>
        ) : (
          "—"
        )}
      </td>
      <td>
        {brand.brand_logo_url ? (
          <img
            src={brand.brand_logo_url}
            alt={brand.brand_name}
            width={60}
            style={{ borderRadius: 6 }}
          />
        ) : (
          "—"
        )}
      </td>
      <td>
        {Array.isArray(brand.brand_categories) && brand.brand_categories.length > 0
          ? brand.brand_categories
              .map((c) => c?.categories?.category_name || "—")
              .join(", ")
          : "—"}
      </td>
      <td>
        {Array.isArray(brand.brand_sub_categories) && brand.brand_sub_categories.length > 0
          ? brand.brand_sub_categories
              .map((s) => s?.sub_categories?.sub_category_name || "—")
              .join(", ")
          : "—"}
      </td>
      <td>{brand.data_source || "—"}</td>
    </tr>
  ))}
</tbody>
      </table>
    </div>
  );
}