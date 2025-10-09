'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ImportLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const { data, error } = await supabase
          .from('import_logs')
          .select('*')
          .order('imported_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setLogs(data || []);
      } catch (error) {
        console.error('Error fetching import logs:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Import History</h1>
      <p style={{ color: '#64748b', marginTop: 8, marginBottom: 24 }}>
        View all data imports and their results
      </p>

      {logs.length === 0 ? (
        <p style={{ color: '#64748b' }}>No import history yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {logs.map(log => (
            <div
              key={log.import_log_id}
              style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 20
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>
                    {log.file_name || 'Unknown file'}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                    {new Date(log.imported_at).toLocaleString()} • {log.import_type}
                  </p>
                </div>
                <span style={{
                  padding: '4px 12px',
                  background: log.status === 'completed' ? '#d1fae5' : log.status === 'partial' ? '#fef3c7' : '#fee2e2',
                  color: log.status === 'completed' ? '#065f46' : log.status === 'partial' ? '#92400e' : '#991b1b',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500
                }}>
                  {log.status}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Processed</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{log.rows_processed} rows</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Created</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#059669' }}>
                    {log.suppliers_created + log.brands_created + log.relationships_created}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Verified</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#3b82f6' }}>
                    {log.relationships_verified}
                  </div>
                </div>
              </div>

              {log.relationships_orphaned > 0 && (
                <div style={{ marginTop: 12, padding: 12, background: '#fef3c7', borderRadius: 6 }}>
                  <span style={{ fontSize: 14, color: '#92400e', fontWeight: 500 }}>
                    🗑️ {log.relationships_orphaned} relationships moved to orphans
                  </span>
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                <a
                  href={`/import/logs/${log.import_log_id}`}
                  style={{
                    padding: '8px 16px',
                    background: '#3b82f6',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500
                  }}
                >
                  View Details
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

