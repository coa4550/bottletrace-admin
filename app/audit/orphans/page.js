'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function OrphansAuditPage() {
  const [orphans, setOrphans] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterBrand, setFilterBrand] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all orphaned relationships
      let allOrphans = [];
      let start = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('core_orphans')
          .select('*')
          .order('created_at', { ascending: false })
          .range(start, start + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allOrphans = [...allOrphans, ...data];
          start += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      setOrphans(allOrphans);

      // Fetch suppliers, brands, and states for lookups
      const [suppliersRes, brandsRes, statesRes] = await Promise.all([
        supabase.from('core_suppliers').select('supplier_id, supplier_name').order('supplier_name'),
        supabase.from('core_brands').select('brand_id, brand_name').order('brand_name'),
        supabase.from('core_states').select('state_id, state_code, state_name').order('state_name')
      ]);

      if (suppliersRes.error) throw suppliersRes.error;
      if (brandsRes.error) throw brandsRes.error;
      if (statesRes.error) throw statesRes.error;

      setSuppliers(suppliersRes.data || []);
      setBrands(brandsRes.data || []);
      setStates(statesRes.data || []);
    } catch (error) {
      console.error('Error fetching orphans:', error);
      alert('Failed to load orphans: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (orphan) => {
    if (!confirm(`Restore this relationship: ${getBrandName(orphan.brand_id)} → ${getSupplierName(orphan.supplier_id)} (${getStateCode(orphan.state_id)})?`)) {
      return;
    }

    try {
      // Insert back into active relationships
      const { error: insertError } = await supabase
        .from('brand_supplier_state')
        .insert({
          brand_id: orphan.brand_id,
          supplier_id: orphan.supplier_id,
          state_id: orphan.state_id,
          is_verified: true,
          last_verified_at: new Date().toISOString(),
          relationship_source: 'restored_from_orphans'
        });

      if (insertError) throw insertError;

      // Delete from orphans
      const { error: deleteError } = await supabase
        .from('core_orphans')
        .delete()
        .eq('orphan_id', orphan.orphan_id);

      if (deleteError) throw deleteError;

      alert('Relationship restored successfully!');
      fetchData(); // Refresh the list
    } catch (error) {
      console.error('Error restoring orphan:', error);
      alert('Failed to restore relationship: ' + error.message);
    }
  };

  const handleDelete = async (orphan) => {
    if (!confirm(`Permanently delete this orphaned relationship: ${getBrandName(orphan.brand_id)} → ${getSupplierName(orphan.supplier_id)} (${getStateCode(orphan.state_id)})?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('core_orphans')
        .delete()
        .eq('orphan_id', orphan.orphan_id);

      if (error) throw error;

      alert('Orphan deleted successfully!');
      fetchData(); // Refresh the list
    } catch (error) {
      console.error('Error deleting orphan:', error);
      alert('Failed to delete orphan: ' + error.message);
    }
  };

  const getSupplierName = (supplierId) => {
    return suppliers.find(s => s.supplier_id === supplierId)?.supplier_name || supplierId;
  };

  const getBrandName = (brandId) => {
    return brands.find(b => b.brand_id === brandId)?.brand_name || brandId;
  };

  const getStateCode = (stateId) => {
    return states.find(s => s.state_id === stateId)?.state_code || stateId;
  };

  const getStateName = (stateId) => {
    return states.find(s => s.state_id === stateId)?.state_name || stateId;
  };

  // Filter orphans
  const filteredOrphans = orphans.filter(orphan => {
    if (filterSupplier && orphan.supplier_id !== filterSupplier) return false;
    if (filterBrand && orphan.brand_id !== filterBrand) return false;
    return true;
  });

  // Group by supplier and brand
  const groupedOrphans = filteredOrphans.reduce((acc, orphan) => {
    const key = `${orphan.supplier_id}|${orphan.brand_id}`;
    if (!acc[key]) {
      acc[key] = {
        supplier_id: orphan.supplier_id,
        brand_id: orphan.brand_id,
        orphans: []
      };
    }
    acc[key].orphans.push(orphan);
    return acc;
  }, {});

  if (loading) {
    return <div style={{ padding: 20 }}>Loading orphaned relationships...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Orphaned Relationships</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>
        These relationships were removed during imports because they weren't in the import file.
        You can restore them or permanently delete them.
      </p>

      {/* Filters */}
      <div style={{ marginTop: 24, marginBottom: 32, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
            Filter by Supplier:
          </label>
          <select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: 14,
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              width: '100%',
              background: 'white'
            }}
          >
            <option value="">All Suppliers ({suppliers.length})</option>
            {suppliers.map(s => (
              <option key={s.supplier_id} value={s.supplier_id}>
                {s.supplier_name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
            Filter by Brand:
          </label>
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: 14,
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              width: '100%',
              background: 'white'
            }}
          >
            <option value="">All Brands ({brands.length})</option>
            {brands.map(b => (
              <option key={b.brand_id} value={b.brand_id}>
                {b.brand_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div style={{ 
        marginBottom: 24, 
        padding: 16, 
        background: '#fef3c7', 
        border: '1px solid #fbbf24',
        borderRadius: 8 
      }}>
        <strong style={{ color: '#92400e' }}>
          {filteredOrphans.length} orphaned relationships
        </strong>
        {filterSupplier || filterBrand ? (
          <span style={{ color: '#92400e', marginLeft: 8 }}>
            (filtered from {orphans.length} total)
          </span>
        ) : null}
      </div>

      {/* Orphaned Relationships Table */}
      {Object.keys(groupedOrphans).length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 14 }}>No orphaned relationships found.</p>
      ) : (
        Object.values(groupedOrphans).map((group, idx) => (
          <div key={idx} style={{ marginBottom: 32 }}>
            <h3 style={{ 
              padding: '12px 16px', 
              background: '#fee2e2', 
              color: '#991b1b',
              borderRadius: '8px 8px 0 0',
              margin: 0,
              fontSize: 16
            }}>
              {getSupplierName(group.supplier_id)} → {getBrandName(group.brand_id)}
              <span style={{ fontSize: 13, marginLeft: 8, fontWeight: 400 }}>
                ({group.orphans.length} states)
              </span>
            </h3>

            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              background: 'white',
              border: '1px solid #fecaca',
              borderTop: 'none'
            }}>
              <thead>
                <tr style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                  <th style={headerStyle}>State</th>
                  <th style={headerStyle}>Was Verified</th>
                  <th style={headerStyle}>Last Verified</th>
                  <th style={headerStyle}>Source</th>
                  <th style={headerStyle}>Reason</th>
                  <th style={headerStyle}>Orphaned At</th>
                  <th style={headerStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.orphans.map(orphan => (
                  <tr key={orphan.orphan_id} style={{ borderBottom: '1px solid #fee2e2' }}>
                    <td style={cellStyle}>{getStateName(orphan.state_id)} ({getStateCode(orphan.state_id)})</td>
                    <td style={cellStyle}>{orphan.was_verified ? '✅' : '—'}</td>
                    <td style={cellStyle}>
                      {orphan.last_verified_at ? new Date(orphan.last_verified_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={cellStyle}>{orphan.relationship_source || '—'}</td>
                    <td style={cellStyle}>{orphan.reason || '—'}</td>
                    <td style={cellStyle}>
                      {orphan.created_at ? new Date(orphan.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleRestore(orphan)}
                          style={{
                            padding: '4px 12px',
                            fontSize: 13,
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => handleDelete(orphan)}
                          style={{
                            padding: '4px 12px',
                            fontSize: 13,
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

const headerStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 13,
  fontWeight: 600,
  color: '#991b1b'
};

const cellStyle = {
  padding: '12px 16px',
  fontSize: 14,
  color: '#1e293b'
};

