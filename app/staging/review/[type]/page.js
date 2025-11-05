'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const TYPE_CONFIG = {
  brands: { title: 'Brand Imports', table: 'brands', fields: ['brand_name', 'brand_url', 'brand_logo_url', 'brand_categories', 'brand_sub_categories', 'data_source'] },
  suppliers: { title: 'Supplier Imports', table: 'suppliers', fields: ['supplier_name', 'supplier_url', 'supplier_logo_url'] },
  distributors: { title: 'Distributor Imports', table: 'distributors', fields: ['distributor_name', 'distributor_url', 'distributor_logo_url'] },
  'supplier-portfolio': { title: 'Supplier Portfolio Imports', table: 'supplier-portfolio', fields: ['supplier_name', 'brand_name', 'supplier_url', 'brand_url', 'brand_categories'] },
  'distributor-portfolio': { title: 'Distributor Portfolio Imports', table: 'distributor-portfolio', fields: ['distributor_name', 'supplier_name', 'state_name', 'state_code'] }
};

export default function StagingReviewPage() {
  const params = useParams();
  const type = params.type;
  const config = TYPE_CONFIG[type];

  const [stagingData, setStagingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, approved, pending
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);

  useEffect(() => {
    if (!config) return;
    fetchStagingData();
  }, [type, filter, page]);

  const fetchStagingData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/staging/${config.table}?filter=${filter}&page=${page}&limit=50`);
      const result = await response.json();
      setStagingData(result.data || []);
      setPagination(result.pagination || { total: 0, totalPages: 0 });
    } catch (error) {
      console.error('Error fetching staging data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleApproval = async (stagingId, currentApproval) => {
    try {
      const response = await fetch('/api/staging/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: config.table,
          stagingId,
          isApproved: !currentApproval
        })
      });

      if (response.ok) {
        fetchStagingData();
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Error toggling approval:', error);
      alert('Error updating approval status: ' + error.message);
    }
  };

  const bulkApprove = async (approve) => {
    if (selectedIds.size === 0) {
      alert('Please select at least one row');
      return;
    }

    try {
      const response = await fetch('/api/staging/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: config.table,
          stagingIds: Array.from(selectedIds),
          isApproved: approve
        })
      });

      if (response.ok) {
        fetchStagingData();
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Error bulk approving:', error);
      alert('Error updating approval status: ' + error.message);
    }
  };

  const migrateApproved = async () => {
    if (!confirm('Migrate all approved rows to production? This will delete staging data after migration.')) {
      return;
    }

    setMigrating(true);
    setMigrationResult(null);

    try {
      const response = await fetch('/api/staging/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: config.table
        })
      });

      const result = await response.json();

      if (result.success) {
        setMigrationResult({
          success: true,
          migrated: result.migrated,
          total: result.total,
          errors: result.errors || [],
          summary: result.summary
        });
        fetchStagingData();
      } else {
        setMigrationResult({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error migrating:', error);
      setMigrationResult({
        success: false,
        error: error.message
      });
    } finally {
      setMigrating(false);
    }
  };

  const toggleSelect = (stagingId) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(stagingId)) {
      newSelected.delete(stagingId);
    } else {
      newSelected.add(stagingId);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === stagingData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stagingData.map(row => row.staging_id)));
    }
  };

  if (!config) {
    return <div style={{ padding: 20 }}>Invalid staging type</div>;
  }

  // Calculate counts from current page data (for display, actual totals come from pagination)
  const approvedCount = filter === 'approved' ? (pagination.total || 0) : stagingData.filter(r => r.is_approved).length;
  const pendingCount = filter === 'pending' ? (pagination.total || 0) : stagingData.filter(r => !r.is_approved).length;

  return (
    <div style={{ padding: 20 }}>
      <h1>{config.title} - Review & Migrate</h1>

      {/* Migration Result */}
      {migrationResult && (
        <div style={{
          marginTop: 20,
          padding: 16,
          background: migrationResult.success ? '#d1fae5' : '#fee2e2',
          border: `1px solid ${migrationResult.success ? '#10b981' : '#ef4444'}`,
          borderRadius: 8
        }}>
          {migrationResult.success ? (
            <div>
              <h3 style={{ marginTop: 0, color: '#065f46' }}>Migration Successful!</h3>
              <p>Migrated {migrationResult.migrated} of {migrationResult.total} approved rows</p>
              {migrationResult.summary && (
                <div style={{ marginTop: 12, fontSize: 14 }}>
                  {migrationResult.summary.brandsCreated > 0 && <p>Brands created: {migrationResult.summary.brandsCreated}</p>}
                  {migrationResult.summary.brandsUpdated > 0 && <p>Brands updated: {migrationResult.summary.brandsUpdated}</p>}
                  {migrationResult.summary.suppliersCreated > 0 && <p>Suppliers created: {migrationResult.summary.suppliersCreated}</p>}
                  {migrationResult.summary.suppliersUpdated > 0 && <p>Suppliers updated: {migrationResult.summary.suppliersUpdated}</p>}
                  {migrationResult.summary.distributorsCreated > 0 && <p>Distributors created: {migrationResult.summary.distributorsCreated}</p>}
                  {migrationResult.summary.distributorsUpdated > 0 && <p>Distributors updated: {migrationResult.summary.distributorsUpdated}</p>}
                  {migrationResult.summary.relationshipsCreated > 0 && <p>Relationships created: {migrationResult.summary.relationshipsCreated}</p>}
                </div>
              )}
              {migrationResult.errors && migrationResult.errors.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Errors:</strong>
                  {migrationResult.errors.map((err, i) => (
                    <p key={i} style={{ fontSize: 13, color: '#dc2626' }}>{err}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <h3 style={{ marginTop: 0, color: '#991b1b' }}>Migration Failed</h3>
              <p>{migrationResult.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Filters and Actions */}
      <div style={{ marginTop: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              background: filter === 'all' ? '#3b82f6' : 'white',
              color: filter === 'all' ? 'white' : '#334155',
              cursor: 'pointer'
            }}
          >
            All ({pagination.total || 0})
          </button>
          <button
            onClick={() => setFilter('approved')}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              background: filter === 'approved' ? '#10b981' : 'white',
              color: filter === 'approved' ? 'white' : '#334155',
              cursor: 'pointer'
            }}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setFilter('pending')}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              background: filter === 'pending' ? '#f59e0b' : 'white',
              color: filter === 'pending' ? 'white' : '#334155',
              cursor: 'pointer'
            }}
          >
            Pending ({pendingCount})
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button
            onClick={() => bulkApprove(true)}
            disabled={selectedIds.size === 0}
            style={{
              padding: '8px 16px',
              border: '1px solid #10b981',
              borderRadius: 6,
              background: selectedIds.size === 0 ? '#f1f5f9' : '#10b981',
              color: selectedIds.size === 0 ? '#94a3b8' : 'white',
              cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Approve Selected ({selectedIds.size})
          </button>
          <button
            onClick={() => bulkApprove(false)}
            disabled={selectedIds.size === 0}
            style={{
              padding: '8px 16px',
              border: '1px solid #ef4444',
              borderRadius: 6,
              background: selectedIds.size === 0 ? '#f1f5f9' : '#ef4444',
              color: selectedIds.size === 0 ? '#94a3b8' : 'white',
              cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Reject Selected ({selectedIds.size})
          </button>
          <button
            onClick={migrateApproved}
            disabled={migrating}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              background: migrating ? '#94a3b8' : '#3b82f6',
              color: 'white',
              cursor: migrating ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            {migrating ? 'Migrating...' : 'Migrate All Approved'}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ marginTop: 32, textAlign: 'center', padding: 40 }}>Loading...</div>
      ) : stagingData.length === 0 ? (
        <div style={{ marginTop: 32, textAlign: 'center', padding: 40, color: '#64748b' }}>
          No staging data found
        </div>
      ) : (
        <>
          <div style={{ marginTop: 24, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 8, overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 14, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === stagingData.length && stagingData.length > 0}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 14, fontWeight: 600 }}>Status</th>
                  {config.fields.map(field => (
                    <th key={field} style={{ padding: '12px', textAlign: 'left', fontSize: 14, fontWeight: 600 }}>
                      {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </th>
                  ))}
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 14, fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stagingData.map((row) => (
                  <tr key={row.staging_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.staging_id)}
                        onChange={() => toggleSelect(row.staging_id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 500,
                        background: row.is_approved ? '#d1fae5' : '#fef3c7',
                        color: row.is_approved ? '#065f46' : '#92400e'
                      }}>
                        {row.is_approved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    {config.fields.map(field => (
                      <td key={field} style={{ padding: '12px', fontSize: 14, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row[field] || '-'}
                      </td>
                    ))}
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => toggleApproval(row.staging_id, row.is_approved)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #cbd5e1',
                          borderRadius: 4,
                          background: row.is_approved ? '#fee2e2' : '#d1fae5',
                          color: row.is_approved ? '#991b1b' : '#065f46',
                          cursor: 'pointer',
                          fontSize: 13
                        }}
                      >
                        {row.is_approved ? 'Reject' : 'Approve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, color: '#64748b' }}>
                Page {page} of {pagination.totalPages} ({pagination.total} total)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    background: page === 1 ? '#f1f5f9' : 'white',
                    cursor: page === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    background: page >= pagination.totalPages ? '#f1f5f9' : 'white',
                    cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
