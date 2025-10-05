cat > brands/page.js <<'EOF'
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
  const [editing, setEditing] = useState({});
  const [search, setSearch] = useState('');

  async function fetchBrands() {
    setLoading(true);
    const { data, error } = await supabase
      .from('core_brands')
      .select('brand_id, brand_name, brand_website, created_at')
      .ilike('brand_name', `%${search}%`)
      .order('brand_name', { ascending: true });

    if (error) console.error(error);
    else setBrands(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchBrands(); }, [search]);

  const handleEdit = (id, field, value) => {
    setEditing(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleSave = async (id) => {
    const updated = editing[id];
    const { error } = await supabase
      .from('core_brands')
      .update(updated)
      .eq('brand_id', id);
    if (!error) {
      setBrands(prev =>
        prev.map(d => (d.brand_id === id ? { ...d, ...updated } : d))
      );
      const newEditing = { ...editing };
      delete newEditing[id];
      setEditing(newEditing);
    } else console.error(error);
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>Brands</h1>
      <input
        type="text"
        placeholder="Search brands..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          marginTop: 16, marginBottom: 16, padding: 8,
          width: '100%', maxWidth: 400, borderRadius: 6, border: '1px solid #cbd5e1'
        }}
      />
      {loading ? (
        <p>Loading brands...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Website</th>
              <th style={{ padding: 8 }}>Created</th>
              <th style={{ padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => {
              const isEditing = editing[b.brand_id];
              return (
                <tr key={b.brand_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 8 }}>
                    {isEditing ? (
                      <input
                        value={isEditing.brand_name}
                        onChange={(e) => handleEdit(b.brand_id, 'brand_name', e.target.value)}
                      />
                    ) : (
                      b.brand_name
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {isEditing ? (
                      <input
                        value={isEditing.brand_website}
                        onChange={(e) => handleEdit(b.brand_id, 'brand_website', e.target.value)}
                      />
                    ) : (
                      b.brand_website || '—'
                    )}
                  </td>
                  <td style={{ padding: 8 }}>{new Date(b.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: 8 }}>
                    {isEditing ? (
                      <button onClick={() => handleSave(b.brand_id)}>💾 Save</button>
                    ) : (
                      <button onClick={() => setEditing({ ...editing, [b.brand_id]: b })}>✏️ Edit</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
EOF