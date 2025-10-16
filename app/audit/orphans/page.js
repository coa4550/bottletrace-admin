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
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [allDistributors, setAllDistributors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Sorting state
  const [brandSortConfig, setBrandSortConfig] = useState({ key: null, direction: 'asc' });
  const [supplierSortConfig, setSupplierSortConfig] = useState({ key: null, direction: 'asc' });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchOrphanedData(),
        fetchAllSuppliers(),
        fetchAllDistributors()
      ]);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      alert('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrphanedData = async () => {
    try {
      await Promise.all([fetchOrphanedBrands(), fetchOrphanedSuppliers()]);
    } catch (error) {
      console.error('Error fetching orphaned data:', error);
      throw error;
    }
  };

  const fetchAllSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('core_suppliers')
        .select('supplier_id, supplier_name')
        .order('supplier_name');
      
      if (error) throw error;
      setAllSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw error;
    }
  };

  const fetchAllDistributors = async () => {
    try {
      const { data, error } = await supabase
        .from('core_distributors')
        .select('distributor_id, distributor_name')
        .order('distributor_name');
      
      if (error) throw error;
      setAllDistributors(data || []);
    } catch (error) {
      console.error('Error fetching distributors:', error);
      throw error;
    }
  };

  const fetchOrphanedBrands = async () => {
    try {
      // Fetch ALL orphaned brands using pagination (Supabase default limit is 1000)
      let allBrands = [];
      let start = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('core_brands')
          .select('brand_id, brand_name, brand_url, brand_logo_url, created_at, orphaned_at, orphaned_reason')
          .eq('is_orphaned', true)
          .order('orphaned_at', { ascending: false, nullsFirst: false })
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

      console.log(`Orphaned brands: ${allBrands.length}`);
      setOrphanedBrands(allBrands);
    } catch (error) {
      console.error('Error fetching orphaned brands:', error);
      throw error;
    }
  };

  const fetchOrphanedSuppliers = async () => {
    try {
      // Fetch ALL orphaned suppliers using pagination (Supabase default limit is 1000)
      let allSuppliers = [];
      let start = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('core_suppliers')
          .select('supplier_id, supplier_name, supplier_url, created_at, orphaned_at, orphaned_reason')
          .eq('is_orphaned', true)
          .order('orphaned_at', { ascending: false, nullsFirst: false })
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

      console.log(`Orphaned suppliers: ${allSuppliers.length}`);
      setOrphanedSuppliers(allSuppliers);
    } catch (error) {
      console.error('Error fetching orphaned suppliers:', error);
      throw error;
    }
  };

  const handleLinkBrandToSupplier = async (brand, supplierId) => {
    if (!supplierId) return;

    const supplier = allSuppliers.find(s => s.supplier_id === supplierId);
    if (!confirm(`Link "${brand.brand_name}" to supplier "${supplier?.supplier_name}"?\n\nThis will create a brand-supplier relationship.`)) {
      return;
    }

    try {
      // Create brand-supplier relationship
      const { error: linkError } = await supabase
        .from('brand_supplier')
        .insert({
          brand_id: brand.brand_id,
          supplier_id: supplierId
        });

      if (linkError) throw linkError;

      alert('Brand linked to supplier successfully! The orphan status has been automatically cleared.');
      fetchOrphanedData(); // Refresh the list
    } catch (error) {
      console.error('Error linking brand to supplier:', error);
      alert('Failed to link brand: ' + error.message);
    }
  };

  const handleLinkSupplierToDistributor = async (supplier, distributorId) => {
    if (!distributorId) return;

    const distributor = allDistributors.find(d => d.distributor_id === distributorId);
    if (!confirm(`Link "${supplier.supplier_name}" to distributor "${distributor?.distributor_name}"?\n\nThis will remove it from orphans and create a supplier-distributor relationship.`)) {
      return;
    }

    try {
      // Need to also select a state for the relationship
      // For now, let's create the relationship without state (will need state selection in UI)
      alert('Note: This feature requires state selection. Please implement state selection dropdown.');
      
      // TODO: Add state selection
      // const { error: linkError } = await supabase
      //   .from('distributor_supplier_state')
      //   .insert({
      //     distributor_id: distributorId,
      //     supplier_id: supplier.original_supplier_id,
      //     state_id: selectedStateId
      //   });

      // if (linkError) throw linkError;

      // // Delete from orphan suppliers table
      // const { error: deleteError } = await supabase
      //   .from('core_orphan_suppliers')
      //   .delete()
      //   .eq('orphan_supplier_id', supplier.orphan_supplier_id);

      // if (deleteError) throw deleteError;

      // alert('Supplier linked to distributor successfully!');
      // fetchOrphanedData(); // Refresh the list
    } catch (error) {
      console.error('Error linking supplier to distributor:', error);
      alert('Failed to link supplier: ' + error.message);
    }
  };

  const brandStats = {
    total: orphanedBrands.length
  };

  const supplierStats = {
    total: orphanedSuppliers.length
  };

  // Sorting functions
  const handleBrandSort = (key) => {
    let direction = 'asc';
    if (brandSortConfig.key === key && brandSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setBrandSortConfig({ key, direction });
  };

  const handleSupplierSort = (key) => {
    let direction = 'asc';
    if (supplierSortConfig.key === key && supplierSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSupplierSortConfig({ key, direction });
  };

  // Sort brands
  const sortedBrands = [...orphanedBrands].sort((a, b) => {
    if (!brandSortConfig.key) return 0;
    
    const aValue = a[brandSortConfig.key];
    const bValue = b[brandSortConfig.key];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (brandSortConfig.key === 'brand_name') {
      return brandSortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    if (brandSortConfig.key === 'orphaned_at' || brandSortConfig.key === 'created_at') {
      const aDate = new Date(aValue);
      const bDate = new Date(bValue);
      return brandSortConfig.direction === 'asc' 
        ? aDate - bDate
        : bDate - aDate;
    }
    
    return 0;
  });

  // Sort suppliers
  const sortedSuppliers = [...orphanedSuppliers].sort((a, b) => {
    if (!supplierSortConfig.key) return 0;
    
    const aValue = a[supplierSortConfig.key];
    const bValue = b[supplierSortConfig.key];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (supplierSortConfig.key === 'supplier_name') {
      return supplierSortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    if (supplierSortConfig.key === 'orphaned_at' || supplierSortConfig.key === 'created_at') {
      const aDate = new Date(aValue);
      const bDate = new Date(bValue);
      return supplierSortConfig.direction === 'asc' 
        ? aDate - bDate
        : bDate - aDate;
    }
    
    return 0;
  });

  if (loading) {
    return <div style={{ padding: 20 }}>Loading orphaned relationships...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Orphaned Records (Admin)</h1>
      <p style={{ color: '#64748b', marginTop: 8, marginBottom: 16 }}>
        Records that exist in the database but have no relationships (brands with no suppliers, suppliers with no distributors).
      </p>
      <div style={{ 
        padding: 12, 
        background: '#dbeafe', 
        border: '1px solid #93c5fd', 
        borderRadius: 6,
        marginBottom: 24,
        fontSize: 14,
        color: '#1e40af'
      }}>
        <strong>ℹ️ Admin Tool:</strong> This page allows direct linking for admin users. 
        Users can submit orphan correction suggestions via the BottleTrace iOS app, which will appear in the <a href="/admin/submissions" style={{ color: '#1e40af', textDecoration: 'underline' }}>Submissions Dashboard</a> for review.
      </div>

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
                <th style={headerStyle}>
                  <button
                    onClick={() => handleBrandSort('brand_name')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: 600,
                      color: '#475569',
                      fontSize: 13
                    }}
                  >
                    Brand Name
                    {brandSortConfig.key === 'brand_name' && (
                      <span style={{ fontSize: 12 }}>
                        {brandSortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th style={headerStyle}>
                  <button
                    onClick={() => handleBrandSort('orphaned_at')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: 600,
                      color: '#475569',
                      fontSize: 13
                    }}
                  >
                    Date Orphaned
                    {brandSortConfig.key === 'orphaned_at' && (
                      <span style={{ fontSize: 12 }}>
                        {brandSortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th style={headerStyle}>Link to Supplier</th>
              </tr>
            </thead>
            <tbody>
              {sortedBrands.map(brand => (
                <tr key={brand.brand_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={cellStyle}>
                    <strong>{brand.brand_name}</strong>
                    {brand.brand_url && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <a href={brand.brand_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                          Link
                        </a>
                      </div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {brand.created_at ? new Date(brand.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={cellStyle}>
                    <select
                      onChange={(e) => handleLinkBrandToSupplier(brand, e.target.value)}
                      style={{
                        padding: '6px 10px',
                        fontSize: 13,
                        border: '1px solid #cbd5e1',
                        borderRadius: 4,
                        minWidth: 200,
                        background: 'white',
                        cursor: 'pointer'
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Select Supplier...</option>
                      {allSuppliers.map(supplier => (
                        <option key={supplier.supplier_id} value={supplier.supplier_id}>
                          {supplier.supplier_name}
                        </option>
                      ))}
                    </select>
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
                    <th style={headerStyle}>
                      <button
                        onClick={() => handleSupplierSort('supplier_name')}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 600,
                          color: '#475569',
                          fontSize: 13
                        }}
                      >
                        Supplier Name
                        {supplierSortConfig.key === 'supplier_name' && (
                          <span style={{ fontSize: 12 }}>
                            {supplierSortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    </th>
                    <th style={headerStyle}>
                      <button
                        onClick={() => handleSupplierSort('orphaned_at')}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 600,
                          color: '#475569',
                          fontSize: 13
                        }}
                      >
                        Date Orphaned
                        {supplierSortConfig.key === 'orphaned_at' && (
                          <span style={{ fontSize: 12 }}>
                            {supplierSortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    </th>
                    <th style={headerStyle}>Link to Distributor (Requires State)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSuppliers.map(supplier => (
                    <tr key={supplier.supplier_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={cellStyle}>
                        <strong>{supplier.supplier_name}</strong>
                        {supplier.supplier_url && (
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            <a href={supplier.supplier_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                              Link
                            </a>
                          </div>
                        )}
                      </td>
                      <td style={cellStyle}>
                        {supplier.created_at ? new Date(supplier.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={cellStyle}>
                        <select
                          onChange={(e) => handleLinkSupplierToDistributor(supplier, e.target.value)}
                          style={{
                            padding: '6px 10px',
                            fontSize: 13,
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            minWidth: 200,
                            background: 'white',
                            cursor: 'pointer'
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>Select Distributor...</option>
                          {allDistributors.map(distributor => (
                            <option key={distributor.distributor_id} value={distributor.distributor_id}>
                              {distributor.distributor_name}
                            </option>
                          ))}
                        </select>
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

