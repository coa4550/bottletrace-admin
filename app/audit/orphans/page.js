'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function OrphansAuditPage() {
  const [activeTab, setActiveTab] = useState('brands'); // 'brands' or 'suppliers'
  const [orphanedBrands, setOrphanedBrands] = useState([]);
  const [orphanedSuppliers, setOrphanedSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrphanedData();
  }, []);

  const fetchOrphanedData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchOrphanedBrands(), fetchOrphanedSuppliers()]);
    } catch (error) {
      console.error('Error fetching orphaned data:', error);
      alert('Failed to load orphaned data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrphanedBrands = async () => {
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

      // Find brands with no supplier relationships (orphaned brands)
      const orphaned = allBrands
        .filter(brand => !brandsWithSuppliers.has(brand.brand_id))
        .map(brand => ({
          ...brand,
          hasSupplier: false,
          orphanType: 'no_supplier'
        }));

      console.log(`Orphaned brands: ${orphaned.length}`);
      setOrphanedBrands(orphaned);
    } catch (error) {
      console.error('Error fetching orphaned brands:', error);
      throw error;
    }
  };

  const fetchOrphanedSuppliers = async () => {
    try {
      // Fetch ALL suppliers with pagination
      let allSuppliers = [];
      let start = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('core_suppliers')
          .select('supplier_id, supplier_name, supplier_url, created_at')
          .order('supplier_name')
          .range(start, start + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allSuppliers = [...allSuppliers, ...data];
          start += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Total suppliers: ${allSuppliers.length}`);

      // Fetch all distributor relationships for suppliers
      const { data: allDistributorRels, error: distributorRelsError } = await supabase
        .from('distributor_supplier_state')
        .select('supplier_id');

      if (distributorRelsError) throw distributorRelsError;

      // Get unique supplier IDs with distributor relationships
      const suppliersWithDistributors = new Set(allDistributorRels.map(r => r.supplier_id));
      console.log(`Suppliers with distributor relationships: ${suppliersWithDistributors.size}`);

      // Find suppliers with no distributor relationships
      const orphaned = allSuppliers.filter(supplier => {
        return !suppliersWithDistributors.has(supplier.supplier_id);
      });

      console.log(`Orphaned suppliers: ${orphaned.length}`);
      setOrphanedSuppliers(orphaned);
    } catch (error) {
      console.error('Error fetching orphaned suppliers:', error);
      throw error;
    }
  };

  const handleMoveBrand = async (brand) => {
    if (!confirm(`Move the brand "${brand.brand_name}" to orphan brands table?\n\nThis will remove it from core_brands and add it to core_orphan_brands.`)) {
      return;
    }

    try {
      // Insert into orphan brands table
      const { error: insertError } = await supabase
        .from('core_orphan_brands')
        .insert({
          brand_name: brand.brand_name,
          brand_url: brand.brand_url,
          brand_logo_url: brand.brand_logo_url,
          original_brand_id: brand.brand_id,
          orphaned_at: new Date().toISOString(),
          reason: 'No supplier relationship'
        });

      if (insertError) throw insertError;

      // Delete from core brands table
      const { error: deleteError } = await supabase
        .from('core_brands')
        .delete()
        .eq('brand_id', brand.brand_id);

      if (deleteError) throw deleteError;

      alert('Brand moved to orphan table successfully!');
      fetchOrphanedData(); // Refresh the list
    } catch (error) {
      console.error('Error moving brand:', error);
      alert('Failed to move brand: ' + error.message);
    }
  };

  const handleMoveSupplier = async (supplier) => {
    if (!confirm(`Move the supplier "${supplier.supplier_name}" to orphan suppliers table?\n\nThis will remove it from core_suppliers and add it to core_orphan_suppliers.`)) {
      return;
    }

    try {
      // Insert into orphan suppliers table
      const { error: insertError } = await supabase
        .from('core_orphan_suppliers')
        .insert({
          supplier_name: supplier.supplier_name,
          supplier_url: supplier.supplier_url,
          original_supplier_id: supplier.supplier_id,
          orphaned_at: new Date().toISOString(),
          reason: 'No distributor relationship'
        });

      if (insertError) throw insertError;

      // Delete from core suppliers table
      const { error: deleteError } = await supabase
        .from('core_suppliers')
        .delete()
        .eq('supplier_id', supplier.supplier_id);

      if (deleteError) throw deleteError;

      alert('Supplier moved to orphan table successfully!');
      fetchOrphanedData(); // Refresh the list
    } catch (error) {
      console.error('Error moving supplier:', error);
      alert('Failed to move supplier: ' + error.message);
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
      fetchOrphanedData(); // Refresh the list
    } catch (error) {
      console.error('Error deleting brand:', error);
      alert('Failed to delete brand: ' + error.message);
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    if (!confirm(`Permanently delete the supplier "${supplier.supplier_name}"?\n\nThis will remove it from the database entirely.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('core_suppliers')
        .delete()
        .eq('supplier_id', supplier.supplier_id);

      if (error) throw error;

      alert('Supplier deleted successfully!');
      fetchOrphanedData(); // Refresh the list
    } catch (error) {
      console.error('Error deleting supplier:', error);
      alert('Failed to delete supplier: ' + error.message);
    }
  };

  const brandStats = {
    total: orphanedBrands.length
  };

  const supplierStats = {
    total: orphanedSuppliers.length
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading orphaned relationships...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Orphaned Records</h1>
      <p style={{ color: '#64748b', marginTop: 8, marginBottom: 24 }}>
        Records that exist in the database but have no relationships (brands with no suppliers, suppliers with no distributors).
      </p>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid #e2e8f0', 
        marginBottom: 24,
        gap: 0
      }}>
        <button
          onClick={() => setActiveTab('brands')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'brands' ? 'white' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'brands' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'brands' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'brands' ? 600 : 400,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          Orphaned Brands ({brandStats.total})
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'suppliers' ? 'white' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'suppliers' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'suppliers' ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === 'suppliers' ? 600 : 400,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          Orphaned Suppliers ({supplierStats.total})
        </button>
      </div>

      {/* Brands Tab Content */}
      {activeTab === 'brands' && (
        <>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#991b1b' }}>{brandStats.total}</div>
              <div style={{ fontSize: 13, color: '#991b1b', marginTop: 4 }}>Brands with No Supplier</div>
            </div>
          </div>

          {/* Brands Table */}
          {loading ? (
            <p>Loading orphaned brands...</p>
          ) : orphanedBrands.length === 0 ? (
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
                <th style={headerStyle}>Created</th>
                <th style={headerStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orphanedBrands.map(brand => (
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
                    <span style={{ color: '#ef4444' }}>❌ No</span>
                  </td>
                  <td style={cellStyle}>
                    {brand.created_at ? new Date(brand.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleMoveBrand(brand)}
                        style={{
                          padding: '4px 12px',
                          fontSize: 13,
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer'
                        }}
                      >
                        Move to Orphan
                      </button>
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
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          )}
        </>
      )}

      {/* Suppliers Tab Content */}
      {activeTab === 'suppliers' && (
        <>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#991b1b' }}>{supplierStats.total}</div>
              <div style={{ fontSize: 13, color: '#991b1b', marginTop: 4 }}>No Distributor</div>
            </div>
          </div>

          {/* Suppliers Table */}
          {loading ? (
            <p>Loading orphaned suppliers...</p>
          ) : orphanedSuppliers.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>No orphaned suppliers found.</p>
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
                    <th style={headerStyle}>Supplier Name</th>
                    <th style={headerStyle}>Has Distributor?</th>
                    <th style={headerStyle}>Created</th>
                    <th style={headerStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orphanedSuppliers.map(supplier => (
                    <tr key={supplier.supplier_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={cellStyle}>
                        <strong>{supplier.supplier_name}</strong>
                        {supplier.supplier_url && (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            <a href={supplier.supplier_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                              {supplier.supplier_url}
                            </a>
                          </div>
                        )}
                      </td>
                      <td style={cellStyle}>
                        <span style={{ color: '#ef4444' }}>❌ No</span>
                      </td>
                      <td style={cellStyle}>
                        {supplier.created_at ? new Date(supplier.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={cellStyle}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => handleMoveSupplier(supplier)}
                            style={{
                              padding: '4px 12px',
                              fontSize: 13,
                              background: '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer'
                            }}
                          >
                            Move to Orphan
                          </button>
                          <button
                            onClick={() => handleDeleteSupplier(supplier)}
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
          )}
        </>
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

