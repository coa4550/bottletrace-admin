cat > states/page.js <<'EOF'
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
export default function StatesPage() {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [search, setSearch] = useState('');

  async function fetchStates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('core_states')
      .select('state_id, state_name, state_code, created_at')
      .ilike('state_name', `%${search}%`)
      .order('state_name', { ascending: true });
    if (error) console.error(error);
    else setStates(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchStates(); }, [search]);

  const handleEdit = (id, field, value) => {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = async (id) => {
    const updated = editing[id];
    const { error } = await supabase.from('core_states').update(updated).eq('state_id', id);
    if (!error) {
      setStates(prev => prev.map(d => (d.state_id === id ? { ...d, ...updated } : d)));
      const newEditing = { ...editing }; delete newEditing[id]; setEditing(newEditing);
    } else console.error(error);
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>States</h1>
      <input
        type="text" placeholder="Search states..." value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginTop: 16, marginBottom: 16, padding: 8, width: '100%', maxWidth: 400, borderRadius: 6, border: '1px solid #cbd5e1' }}
      />
      {loading ? <p>Loading states...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>Name</th><th style={{ padding: 8 }}>Code</th><th style={{ padding: 8 }}>Created</th><th style={{ padding: 8 }}>Actions</th></tr></thead>
          <tbody>{states.map((s) => {
            const isEditing = editing[s.state_id];
            return (
              <tr key={s.state_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: 8 }}>{isEditing ? <input value={isEditing.state_name} onChange={(e) => handleEdit(s.state_id, 'state_name', e.target.value)} /> : s.state_name}</td>
                <td style={{ padding: 8 }}>{isEditing ? <input value={isEditing.state_code} onChange={(e) => handleEdit(s.state_id, 'state_code', e.target.value)} /> : s.state_code}</td>
                <td style={{ padding: 8 }}>{new Date(s.created_at).toLocaleDateString()}</td>
                <td style={{ padding: 8 }}>{isEditing ? <button onClick={() => handleSave(s.state_id)}>💾 Save</button> : <button onClick={() => setEditing({ ...editing, [s.state_id]: s })}>✏️ Edit</button>}</td>
              </tr>);
          })}</tbody>
        </table>)}
    </div>
  );
}
EOF