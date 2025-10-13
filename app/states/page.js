'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import SearchInput from '@/components/SearchInput';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function StatesPage() {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colWidths, setColWidths] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('stateColWidths');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchStates() {
      try {
        const { data, error } = await supabase
          .from('core_states')
          .select('*')
          .order('state_name');

        if (error) throw error;
        setStates(data || []);
      } catch (error) {
        console.error('Error fetching states:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStates();
  }, []);

  const startResize = (e, key) => {
    const startX = e.clientX;
    const startWidth = colWidths[key] || 150;

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(60, startWidth + moveEvent.clientX - startX);
      setColWidths((prev) => {
        const updated = { ...prev, [key]: newWidth };
        localStorage.setItem('stateColWidths', JSON.stringify(updated));
        return updated;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleEdit = async (stateId, field, newValue) => {
    try {
      const { error } = await supabase
        .from('core_states')
        .update({ [field]: newValue })
        .eq('state_id', stateId);

      if (error) throw error;
      setStates((prev) =>
        prev.map((s) => (s.state_id === stateId ? { ...s, [field]: newValue } : s))
      );
    } catch (err) {
      console.error('Update error:', err.message);
      alert('Failed to update Supabase.');
    }
  };

  const columns = [
    { key: 'state_name', label: 'State Name', editable: true },
    { key: 'state_code', label: 'State Code', editable: true },
  ];

  // Filter states based on search term
  const filteredStates = states.filter(state => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      state.state_name?.toLowerCase().includes(searchLower) ||
      state.state_code?.toLowerCase().includes(searchLower)
    );
  });

  const sortedStates = [...filteredStates].sort((a, b) => {
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
      <h1 style={{ marginBottom: 16 }}>States ({states.length})</h1>
      <div style={{ marginBottom: 16 }}>
        <SearchInput 
          placeholder="Search states..." 
          onSearch={setSearchTerm}
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            tableLayout: 'auto',
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
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortConfig.key === col.key && (
                    <span style={{ marginLeft: 4 }}>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                  <div
                    onMouseDown={(e) => startResize(e, col.key)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      height: '100%',
                      width: '5px',
                      cursor: 'col-resize',
                      background: 'transparent',
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedStates.map((s) => (
              <tr key={s.state_id}>
                {columns.map((col) => {
                  const value = s[col.key];
                  const editable = col.editable;

                  if (editable)
                    return (
                      <td key={col.key} style={cellStyle}>
                        <EditableCell
                          value={value}
                          onChange={(val) => handleEdit(s.state_id, col.key, val)}
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

const cellStyle = {
  padding: '8px 12px',
  borderBottom: '1px solid #f1f5f9',
  whiteSpace: 'nowrap',
  maxWidth: 400,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

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
    <div
      onClick={() => setEditing(true)}
      style={{ cursor: 'text', minWidth: 80 }}
      title="Click to edit"
    >
      {value || '—'}
    </div>
  );
}
