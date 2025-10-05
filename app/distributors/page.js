'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase client (public)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [search, setSearch] = useState('');

  // Load distributors from Supabase
  async function fetchDistributors() {
    setLoading(true);
    const { data, error } = await supabase
      .from('core_distributors')
      .select('distributor_id, distributor_name, distributor_website, created_at')
      .ilike('distributor_name', `%${search}%`)
      .order('distributor_name', { ascending: true });

    if (error) console.error(error);
    else setDistributors(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchDistributors(); }, [search]);

  // Handle edit toggle and save
  const handleEdit = (id, field, value) => {
    setEditing(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleSave = async (id) => {
    const updated = editing[id];
    const { error } = await supabase
      .from('core_distributors')
      .update(updated)
      .eq('distributor_id', id);

    if (!error) {
      setDistributors(prev =>
        prev.map(d => (d.distributor_id === id ? { ...d, ...updated } : d))
      );
      const newEditing = { ...editing };
      delete newEditing[id];
      setEditing(newEditing);
    } else console.error(error);
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>Distributors</h1>
      <input
        type="text"
        placeholder="Search distributors..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          marginTop: 16,
          marginBottom: 16,
          padding: 8,
          width: '100%',
          maxWidth: 400,
          borderRadius: 6,
          border: '1px solid #cbd5e1'
        }}
      />

      {loading ? (
        <p>Loading distributors...</p>
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
            {distributors.map((d) => {
              const isEditing = editing[d.distributor_id];
              return (
                <tr key={d.distributor_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 8 }}>
                    {isEditing ? (
                      <input
                        value={isEditing.distributor_name}
                        onChange={(e) => handleEdit(d.distributor_id, 'distributor_name', e.target.value)}
                      />
                    ) : (
                      d.distributor_name
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    {isEditing ? (
                      <input
                        value={isEditing.distributor_website}
                        onChange={(e) => handleEdit(d.distributor_id, 'distributor_website', e.target.value)}
                      />
                    ) : (
                      d.distributor_website || '—'
                    )}
                  </td>
                  <td style={{ padding: 8 }}>{new Date(d.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: 8 }}>
                    {isEditing ? (
                      <button onClick={() => handleSave(d.distributor_id)}>💾 Save</button>
                    ) : (
                      <button onClick={() => setEditing({ ...editing, [d.distributor_id]: d })}>✏️ Edit</button>
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
