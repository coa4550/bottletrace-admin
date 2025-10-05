'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [search, setSearch] = useState('');

  async function fetchSuppliers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('core_suppliers')
      .select('supplier_id, supplier_name, supplier_website, created_at')
      .ilike('supplier_name', `%${search}%`)
      .order('supplier_name', { ascending: true });
    if (error) console.error(error);
    else setSuppliers(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchSuppliers(); }, [search]);

  const handleEdit = (id, field, value) => {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = async (id) => {
    const updated = editing[id];
    const { error } = await supabase.from('core_suppliers').update(updated).eq('supplier_id', id);
    if (!error) {
      setSuppliers(prev => prev.map(d => (d.supplier_id === id ? { ...d, ...updated } : d)));
      const newEditing = { ...editing }; delete newEditing[id]; setEditing(newEditing);
    } else console.error(error);
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>Suppliers</h1>
      <input
        type="text" placeholder="Search suppliers..." value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginTop: 16, marginBottom: 16, padding: 8, width: '100%', maxWidth: 400, borderRadius: 6, border: '1px solid #cbd5e1' }}
      />
      {loading ? <p>Loading suppliers...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>Name</th><th style={{ padding: 8 }}>Website</th><th style={{ padding: 8 }}>Created</th><th style={{ padding: 8 }}>Actions</th></tr></thead>
          <tbody>{suppliers.map((s) => {
            const isEditing = editing[s.supplier_id];
            return (
              <tr key={s.supplier_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: 8 }}>{isEditing ? <input value={isEditing.supplier_name} onChange={(e) => handleEdit(s.supplier_id, 'supplier_name', e.target.value)} /> : s.supplier_name}</td>
                <td style={{ padding: 8 }}>{isEditing ? <input value={isEditing.supplier_website} onChange={(e) => handleEdit(s.supplier_id, 'supplier_website', e.target.value)} /> : s.supplier_website || '—'}</td>
                <td style={{ padding: 8 }}>{new Date(s.created_at).toLocaleDateString()}</td>
                <td style={{ padding: 8 }}>{isEditing ? <button onClick={() => handleSave(s.supplier_id)}>💾 Save</button> : <button onClick={() => setEditing({ ...editing, [s.supplier_id]: s })}>✏️ Edit</button>}</td>
              </tr>);
          })}</tbody>
        </table>)}
    </div>
  );
}
EOF