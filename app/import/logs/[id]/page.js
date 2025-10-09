'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ImportLogDetailPage() {
  const params = useParams();
  const [log, setLog] = useState(null);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    async function fetchLogDetail() {
      try {
        // Fetch import log
        const { data: logData, error: logError } = await supabase
          .from('import_logs')
          .select('*')
          .eq('import_log_id', params.id)
          .single();

        if (logError) throw logError;
        setLog(logData);

        // Fetch all changes for this import
        const { data: changesData, error: changesError } = await supabase
          .from('import_changes')
          .select('*')
          .eq('import_log_id', params.id)
          .order('created_at');

        if (changesError) throw changesError;
        setChanges(changesData || []);
      } catch (error) {
        console.error('Error fetching log details:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchLogDetail();
  }, [params.id]);

  const filteredChanges = filterType === 'all' 
    ? changes 
    : changes.filter(c => c.change_type === filterType);

  const getChangeIcon = (type) => {
    switch(type) {
      case 'brand_created': return '🆕';
      case 'supplier_created': return '🏢';
      case 'relationship_created': return '🔗';
      case 'relationship_verified': return '✓';
      case 'relationship_orphaned': return '🗑️';
      default: return '•';
    }
  };

  const getChangeColor = (type) => {
    switch(type) {
      case 'brand_created':
      case 'supplier_created':
      case 'relationship_created':
        return '#059669';
      case 'relationship_verified':
        return '#3b82f6';
      case 'relationship_orphaned':
        return '#d97706';
      default:
        return '#64748b';
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!log) return <p>Import log not found.</p>;

  return (
    <div style={{ padding: 20 }}>
      <a href="/import/logs" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14 }}>
        ← Back to Import History
      </a>

      <h1 style={{ marginTop: 16 }}>Import Log Details</h1>

      {/* Summary Card */}
      <div style={{
        marginTop: 24,
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{log.file_name}</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: 14 }}>
              {new Date(log.imported_at).toLocaleString()}
            </p>
          </div>
          <span style={{
            padding: '4px 12px',
            background: log.status === 'completed' ? '#d1fae5' : '#fef3c7',
            color: log.status === 'completed' ? '#065f46' : '#92400e',
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 500,
            height: 'fit-content'
          }}>
            {log.status}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Rows Processed</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{log.rows_processed}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Suppliers Created</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: '#059669' }}>{log.suppliers_created}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Brands Created</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: '#059669' }}>{log.brands_created}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Relationships Created</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: '#059669' }}>{log.relationships_created}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Relationships Verified</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: '#3b82f6' }}>{log.relationships_verified}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Relationships Orphaned</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: '#d97706' }}>{log.relationships_orphaned}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Rows Skipped</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: '#64748b' }}>{log.rows_skipped}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#64748b' }}>Errors</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: '#dc2626' }}>{log.errors_count}</div>
          </div>
        </div>
      </div>

      {/* Changes Filter */}
      <div style={{ marginTop: 32, marginBottom: 16 }}>
        <label style={{ fontSize: 14, fontWeight: 500, marginRight: 12 }}>Filter by type:</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '6px 12px',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontSize: 14
          }}
        >
          <option value="all">All Changes ({changes.length})</option>
          <option value="brand_created">Brands Created ({changes.filter(c => c.change_type === 'brand_created').length})</option>
          <option value="supplier_created">Suppliers Created ({changes.filter(c => c.change_type === 'supplier_created').length})</option>
          <option value="relationship_created">Relationships Created ({changes.filter(c => c.change_type === 'relationship_created').length})</option>
          <option value="relationship_verified">Relationships Verified ({changes.filter(c => c.change_type === 'relationship_verified').length})</option>
          <option value="relationship_orphaned">Relationships Orphaned ({changes.filter(c => c.change_type === 'relationship_orphaned').length})</option>
        </select>
      </div>

      {/* Changes List */}
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '12px 16px', 
          background: '#f8fafc', 
          borderBottom: '1px solid #e2e8f0',
          fontWeight: 600 
        }}>
          Detailed Changes ({filteredChanges.length})
        </div>
        {filteredChanges.length === 0 ? (
          <p style={{ padding: 16, color: '#64748b' }}>No changes to display</p>
        ) : (
          <div style={{ maxHeight: 600, overflow: 'auto' }}>
            {filteredChanges.map((change, idx) => (
              <div
                key={change.change_id}
                style={{
                  padding: '12px 16px',
                  borderBottom: idx < filteredChanges.length - 1 ? '1px solid #f1f5f9' : 'none',
                  display: 'flex',
                  alignItems: 'start',
                  gap: 12
                }}
              >
                <span style={{ fontSize: 20 }}>{getChangeIcon(change.change_type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 500,
                    color: getChangeColor(change.change_type)
                  }}>
                    {change.entity_name}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                    {change.change_type.replace(/_/g, ' ')}
                  </div>
                  {change.source_row && Object.keys(change.source_row).length > 0 && (
                    <details style={{ marginTop: 8, fontSize: 12 }}>
                      <summary style={{ cursor: 'pointer', color: '#64748b' }}>View source data</summary>
                      <pre style={{ 
                        marginTop: 8, 
                        padding: 12, 
                        background: '#f8fafc', 
                        borderRadius: 4,
                        overflow: 'auto',
                        fontSize: 11
                      }}>
                        {JSON.stringify(change.source_row, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {new Date(change.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

