'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function OrphansAuditPage() {
  const [orphanedBrands, setOrphanedBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'no_supplier', 'no_distributor', 'none'

  useEffect(() => {
    fetchOrphanedBrands();
  }, []);

  const fetchOrphanedBrands = async () => {
    setLoading(true);
    try {
      // Fetch ALL brands with pagination
      let allBrands = [];
      let start = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('core_brands')
          .select('brand_id, brand_name, brand_url, brand_logo_url, created_at')
          .order('brand_name')
          .range(start, start + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allBrands = [...allBrands, ...data];
          start += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Total brands: ${allBrands.length}`);

      // Fetch all supplier relationships
      const { data: allSupplierRels, error: supplierRelsError } = await supabase
        .from('brand_supplier')
        .select('brand_id');

      if (supplierRelsError) throw supplierRelsError;

      // Get unique brand IDs with supplier relationships
      const brandsWithSuppliers = new Set(allSupplierRels.map(r => r.brand_id));
      console.log(`Brands with supplier relationships: ${brandsWithSuppliers.size}`);

      // Fetch all distributor relationships
      let allDistributorRels = [];
      start = 0;
      hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('brand_distributor_state')
          .select('brand_id')
          .range(start, start + pageSize - 1);

        if (error && error.code !== '42P01') throw error; // Ignore if table doesn't exist

        if (data && data.length > 0) {
          allDistributorRels = [...allDistributorRels, ...data];
          start += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Get unique brand IDs with distributor relationships
      const brandsWithDistributors = new Set(allDistributorRels.map(r => r.brand_id));
      console.log(`Brands with distributor relationships: ${brandsWithDistributors.size}`);

      // Classify each brand
      const orphaned = allBrands.map(brand => {
        const hasSupplier = brandsWithSuppliers.has(brand.brand_id);
        const hasDistributor = brandsWithDistributors.has(brand.brand_id);

        let orphanType = null;
        if (!hasSupplier && !hasDistributor) {
          orphanType = 'none'; // No relationships at all
        } else if (!hasSupplier) {
          orphanType = 'no_supplier'; // Only has distributor
        } else if (!hasDistributor) {
          orphanType = 'no_distributor'; // Only has supplier
        }

        return {
          ...brand,
          hasSupplier,
          hasDistributor,
          orphanType
        };
      }).filter(brand => brand.orphanType !== null); // Only show orphaned brands

      console.log(`Orphaned brands: ${orphaned.length}`);
      setOrphanedBrands(orphaned);
    } catch (error) {
      console.error('Error fetching orphaned brands:', error);
      alert('Failed to load orphaned brands: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBrand = async (brand) => {
    if (!confirm(`Permanently delete the brand "${brand.brand_name}"?\n\nThis will remove it from the database entirely.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('core_brands')
        .delete()
        .eq('brand_id', brand.brand_id);

      if (error) throw error;

      alert('Brand deleted successfully!');
      fetchOrphanedBrands(); // Refresh the list
    } catch (error) {
      console.error('Error deleting brand:', error);
      alert('Failed to delete brand: ' + error.message);
    }
  };

  // Filter orphaned brands based on type
  const filteredBrands = orphanedBrands.filter(brand => {
    if (filter === 'all') return true;
    return brand.orphanType === filter;
  });

  const stats = {
    total: orphanedBrands.length,
    none: orphanedBrands.filter(b => b.orphanType === 'none').length,
    noSupplier: orphanedBrands.filter(b => b.orphanType === 'no_supplier').length,
    noDistributor: orphanedBrands.filter(b => b.orphanType === 'no_distributor').length
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading orphaned relationships...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Orphaned Brands</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>
        Brands that exist in the database but have no supplier or distributor relationships.
      </p>

      {/* Filter */}
      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
          Filter by Type:
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            minWidth: 300,
            background: 'white'
          }}
        >
          <option value="all">All Orphaned Brands ({stats.total})</option>
          <option value="none">No Relationships At All ({stats.none})</option>
          <option value="no_supplier">Has Distributor, No Supplier ({stats.noSupplier})</option>
          <option value="no_distributor">Has Supplier, No Distributor ({stats.noDistributor})</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#991b1b' }}>{stats.none}</div>
          <div style={{ fontSize: 13, color: '#991b1b', marginTop: 4 }}>No Relationships</div>
        </div>
        <div style={{ padding: 16, background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#92400e' }}>{stats.noSupplier}</div>
          <div style={{ fontSize: 13, color: '#92400e', marginTop: 4 }}>No Supplier</div>
        </div>
        <div style={{ padding: 16, background: '#dbeafe', border: '1px solid #60a5fa', borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#1e40af' }}>{stats.noDistributor}</div>
          <div style={{ fontSize: 13, color: '#1e40af', marginTop: 4 }}>No Distributor</div>
        </div>
        <div style={{ padding: 16, background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#475569' }}>{stats.total}</div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>Total Orphaned</div>
        </div>
      </div>

      {/* Brands Table */}
      {loading ? (
        <p>Loading orphaned brands...</p>
      ) : filteredBrands.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 14 }}>No orphaned brands found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 8
          }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={headerStyle}>Brand Name</th>
                <th style={headerStyle}>Has Supplier?</th>
                <th style={headerStyle}>Has Distributor?</th>
                <th style={headerStyle}>Created</th>
                <th style={headerStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBrands.map(brand => (
                <tr key={brand.brand_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={cellStyle}>
                    <strong>{brand.brand_name}</strong>
                    {brand.brand_url && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        <a href={brand.brand_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                          {brand.brand_url}
                        </a>
                      </div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {brand.hasSupplier ? (
                      <span style={{ color: '#10b981' }}>✅ Yes</span>
                    ) : (
                      <span style={{ color: '#ef4444' }}>❌ No</span>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {brand.hasDistributor ? (
                      <span style={{ color: '#10b981' }}>✅ Yes</span>
                    ) : (
                      <span style={{ color: '#ef4444' }}>❌ No</span>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {brand.created_at ? new Date(brand.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={cellStyle}>
                    <button
                      onClick={() => handleDeleteBrand(brand)}
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
                      Delete Brand
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const headerStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 13,
  fontWeight: 600,
  color: '#475569'
};

const cellStyle = {
  padding: '12px 16px',
  fontSize: 14,
  color: '#1e293b'
};

