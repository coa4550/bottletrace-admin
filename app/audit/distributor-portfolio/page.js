'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AuditDistributorPortfolioPage() {
  const [distributors, setDistributors] = useState([]);
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [distributorInfo, setDistributorInfo] = useState(null);
  const [portfolioSuppliers, setPortfolioSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState(new Set());

  useEffect(() => {
    async function fetchDistributors() {
      try {
        const response = await fetch('/api/distributors');
        const data = await response.json();
        
        if (response.ok) {
          console.log('Fetched distributors:', data?.length || 0, 'at', new Date().toISOString());
          setDistributors(data || []);
        } else {
          console.error('Error fetching distributors:', data.error);
        }
      } catch (err) {
        console.error('Error fetching distributors:', err);
      }
    }
    fetchDistributors();
  }, []);

  useEffect(() => {
    if (!selectedDistributor) return;

    async function fetchDistributorData() {
      setLoading(true);
      try {
        const response = await fetch('/api/distributors');
        const distributorsData = await response.json();
        
        if (!response.ok) {
          throw new Error(distributorsData.error || 'Failed to fetch distributors');
        }
        
        const distributor = distributorsData.find(d => d.distributor_id === selectedDistributor);
        if (!distributor) {
          throw new Error('Distributor not found');
        }
        
        setDistributorInfo(distributor);

        // Fetch suppliers for this distributor directly via distributor_supplier_state
        console.log('Fetching supplier relationships for distributor:', selectedDistributor);

        const { data: distSupplierRels, error: distSupplierError } = await supabase
          .from('distributor_supplier_state')
          .select('*')
          .eq('distributor_id', selectedDistributor);

        if (distSupplierError) {
          throw new Error('Failed to fetch distributor-supplier relationships');
        }

        // Create relationship map
        const relationshipMap = {};
        distSupplierRels?.forEach(rel => {
          if (!relationshipMap[rel.supplier_id]) {
            relationshipMap[rel.supplier_id] = rel;
          }
        });

        const supplierIds = [...new Set(distSupplierRels?.map(r => r.supplier_id) || [])];
        console.log('Total unique suppliers for distributor:', supplierIds.length);

        if (supplierIds.length === 0) {
          setPortfolioSuppliers([]);
          return;
        }

        // Fetch supplier details
        const { data: suppliers, error: suppliersError } = await supabase
          .from('core_suppliers')
          .select('*')
          .in('supplier_id', supplierIds)
          .order('supplier_name');

        if (suppliersError) {
          throw new Error('Failed to fetch supplier details');
        }

        // Enrich suppliers with relationship metadata
        const enrichedSuppliers = suppliers?.map(supplier => {
          const rel = relationshipMap[supplier.supplier_id];
          return {
            ...supplier,
            admin_verified_at: rel?.admin_verified_at || null,
            created_at: rel?.created_at || null,
            state_id: rel?.state_id || null
          };
        }) || [];

        console.log('Total suppliers found:', enrichedSuppliers.length);
        setPortfolioSuppliers(enrichedSuppliers);
      } catch (error) {
        console.error('Error fetching distributor data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDistributorData();
  }, [selectedDistributor]);

  const handleDistributorInfoEdit = async (field, newValue) => {
    try {
      const { error } = await supabase
        .from('core_distributors')
        .update({ [field]: newValue })
        .eq('distributor_id', selectedDistributor);

      if (error) throw error;
      setDistributorInfo(prev => ({ ...prev, [field]: newValue }));
    } catch (err) {
      console.error('Update error:', err.message);
      alert('Failed to update distributor info.');
    }
  };

  const handleSupplierEdit = async (supplierId, field, newValue) => {
    try {
      const { error } = await supabase
        .from('core_suppliers')
        .update({ [field]: newValue })
        .eq('supplier_id', supplierId);

      if (error) throw error;
      setPortfolioSuppliers(prev =>
        prev.map(s => (s.supplier_id === supplierId ? { ...s, [field]: newValue } : s))
      );
    } catch (err) {
      console.error('Update error:', err.message);
      alert('Failed to update supplier.');
    }
  };

  const handleDeleteSupplier = async (supplierId, supplierName) => {
    if (!confirm(`Delete "${supplierName}" from the database?\n\nThis will remove the supplier and all its relationships permanently.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('core_suppliers')
        .delete()
        .eq('supplier_id', supplierId);

      if (error) throw error;

      setPortfolioSuppliers(prev => prev.filter(s => s.supplier_id !== supplierId));
      setSelectedSuppliers(prev => {
        const updated = new Set(prev);
        updated.delete(supplierId);
        return updated;
      });
      alert('Supplier deleted successfully!');
    } catch (err) {
      console.error('Delete error:', err.message);
      alert('Failed to delete supplier: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSuppliers.size === 0) {
      alert('No suppliers selected');
      return;
    }

    const supplierNames = portfolioSuppliers
      .filter(s => selectedSuppliers.has(s.supplier_id))
      .map(s => s.supplier_name)
      .join('\n• ');

    if (!confirm(`Delete ${selectedSuppliers.size} suppliers from the database?\n\n• ${supplierNames}\n\nThis will remove all selected suppliers and their relationships permanently.`)) {
      return;
    }

    try {
      const supplierIdsToDelete = Array.from(selectedSuppliers);
      
      const batchSize = 10;
      for (let i = 0; i < supplierIdsToDelete.length; i += batchSize) {
        const batch = supplierIdsToDelete.slice(i, i + batchSize);
        const { error } = await supabase
          .from('core_suppliers')
          .delete()
          .in('supplier_id', batch);

        if (error) throw error;
      }

      setPortfolioSuppliers(prev => prev.filter(s => !selectedSuppliers.has(s.supplier_id)));
      setSelectedSuppliers(new Set());
      alert(`Successfully deleted ${supplierIdsToDelete.length} suppliers!`);
    } catch (err) {
      console.error('Bulk delete error:', err.message);
      alert('Failed to delete suppliers: ' + err.message);
    }
  };

  const toggleSupplierSelection = (supplierId) => {
    setSelectedSuppliers(prev => {
      const updated = new Set(prev);
      if (updated.has(supplierId)) {
        updated.delete(supplierId);
      } else {
        updated.add(supplierId);
      }
      return updated;
    });
  };

  const toggleSelectAll = () => {
    if (selectedSuppliers.size === portfolioSuppliers.length) {
      setSelectedSuppliers(new Set());
    } else {
      setSelectedSuppliers(new Set(portfolioSuppliers.map(s => s.supplier_id)));
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Audit Distributor Portfolio</h1>
      
      <div style={{ marginTop: 24, marginBottom: 32 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
          Select Distributor:
        </label>
        <select
          value={selectedDistributor || ''}
          onChange={(e) => setSelectedDistributor(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            minWidth: 300,
            background: 'white'
          }}
        >
          <option value="">-- Choose a distributor --</option>
          {distributors.map(d => (
            <option key={d.distributor_id} value={d.distributor_id}>
              {d.distributor_name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Loading distributor data...</p>}

      {!loading && selectedDistributor && distributorInfo && (
        <>
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 20, marginBottom: 16, color: '#1e293b' }}>Distributor Information</h2>
            <div style={{ 
              background: 'white', 
              border: '1px solid #e2e8f0', 
              borderRadius: 8, 
              padding: 20 
            }}>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div style={{ flex: 1, display: 'grid', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                      Distributor Name
                    </label>
                    <EditableInput
                      value={distributorInfo.distributor_name}
                      onChange={(val) => handleDistributorInfoEdit('distributor_name', val)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                      Distributor URL
                    </label>
                    <EditableInput
                      value={distributorInfo.distributor_url}
                      onChange={(val) => handleDistributorInfoEdit('distributor_url', val)}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                    Distributor Logo
                  </label>
                  {distributorInfo.distributor_logo_url ? (
                    <div style={{
                      width: 120,
                      height: 120,
                      border: '2px solid #e2e8f0',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'white',
                      overflow: 'hidden',
                      padding: 12
                    }}>
                      <img 
                        src={distributorInfo.distributor_logo_url} 
                        alt={distributorInfo.distributor_name}
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '100%',
                          objectFit: 'contain'
                        }}
                        onError={(e) => {
                          console.error('Failed to load logo:', distributorInfo.distributor_logo_url);
                          e.target.parentElement.innerHTML = `
                            <div style="color: #ef4444; font-size: 13px; text-align: center; padding: 16px;">
                              ⚠️ Failed to load logo
                            </div>
                          `;
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: 120,
                      height: 120,
                      border: '2px dashed #cbd5e1',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#f8fafc',
                      color: '#94a3b8',
                      fontSize: 13
                    }}>
                      No logo
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                  Distributor Logo URL
                </label>
                <EditableInput
                  value={distributorInfo.distributor_logo_url}
                  onChange={(val) => handleDistributorInfoEdit('distributor_logo_url', val)}
                />
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, margin: 0, color: '#1e293b' }}>
                Distributor Supplier Relationships ({portfolioSuppliers.length} suppliers)
              </h2>
              {selectedSuppliers.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  style={{
                    padding: '8px 16px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: 14
                  }}
                >
                  Delete {selectedSuppliers.size} Selected Supplier{selectedSuppliers.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
            {portfolioSuppliers.length === 0 ? (
              <p style={{ color: '#64748b' }}>No suppliers found for this distributor.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  tableLayout: 'fixed',
                  borderCollapse: 'collapse',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8
                }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px', textAlign: 'center', width: '30px', fontSize: 13, fontWeight: 600, color: '#475569' }}>
                        <input
                          type="checkbox"
                          checked={selectedSuppliers.size === portfolioSuppliers.length && portfolioSuppliers.length > 0}
                          onChange={toggleSelectAll}
                          style={{ cursor: 'pointer' }}
                          title="Select all suppliers"
                        />
                      </th>
                      <th style={{ ...headerStyle, width: '20%' }}>Supplier Name</th>
                      <th style={{ ...headerStyle, width: '14%' }}>Verified Date</th>
                      <th style={{ ...headerStyle, width: '23%' }}>Supplier URL</th>
                      <th style={{ ...headerStyle, width: '23%' }}>Logo URL</th>
                      <th style={{ ...headerStyle, width: '90px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioSuppliers.map(supplier => (
                      <tr 
                        key={supplier.supplier_id} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9',
                          background: selectedSuppliers.has(supplier.supplier_id) ? '#eff6ff' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedSuppliers.has(supplier.supplier_id)}
                            onChange={() => toggleSupplierSelection(supplier.supplier_id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={cellStyle}>
                          <EditableCell
                            value={supplier.supplier_name}
                            onChange={(val) => handleSupplierEdit(supplier.supplier_id, 'supplier_name', val)}
                          />
                        </td>
                        <td style={cellStyle}>
                          <VerifiedDate 
                            date={supplier.admin_verified_at} 
                            createdDate={supplier.created_at}
                          />
                        </td>
                        <td style={cellStyle}>
                          <EditableCell
                            value={supplier.supplier_url}
                            onChange={(val) => handleSupplierEdit(supplier.supplier_id, 'supplier_url', val)}
                          />
                        </td>
                        <td style={cellStyle}>
                          <EditableCell
                            value={supplier.supplier_logo_url}
                            onChange={(val) => handleSupplierEdit(supplier.supplier_id, 'supplier_logo_url', val)}
                          />
                        </td>
                        <td style={cellStyle}>
                          <button
                            onClick={() => handleDeleteSupplier(supplier.supplier_id, supplier.supplier_name)}
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!selectedDistributor && !loading && (
        <p style={{ color: '#64748b', marginTop: 40 }}>
          Please select a distributor to view and audit their portfolio.
        </p>
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

function EditableInput({ value, onChange, style }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value || '');

  useEffect(() => {
    setTemp(value || '');
  }, [value]);

  const handleBlur = () => {
    setEditing(false);
    if (temp !== value) onChange(temp);
  };

  if (editing) {
    return (
      <input
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={handleBlur}
        autoFocus
        style={{
          width: '100%',
          padding: '6px 8px',
          border: '1px solid #3b82f6',
          borderRadius: 4,
          fontSize: 14,
          ...style
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        padding: '6px 8px',
        cursor: 'text',
        minHeight: 32,
        borderRadius: 4,
        border: '1px solid transparent',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
        maxWidth: '100%',
        ...style
      }}
      onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
      onMouseLeave={(e) => e.target.style.background = 'transparent'}
      title={value || "Click to edit"}
    >
      {value || '—'}
    </div>
  );
}

function EditableCell({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value || '');

  const handleBlur = () => {
    setEditing(false);
    if (temp !== value) onChange(temp);
  };

  if (editing) {
    return (
      <input
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={handleBlur}
        autoFocus
        style={{
          width: '100%',
          padding: 4,
          border: '1px solid #3b82f6',
          borderRadius: 4,
          fontSize: 14
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{ 
        cursor: 'text', 
        minWidth: 80,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}
      title={value || "Click to edit"}
    >
      {value || '—'}
    </div>
  );
}

// Component to display verified date (or created date if not verified)
function VerifiedDate({ date, createdDate }) {
  // Use verified date if available, otherwise fall back to created date
  const displayDate = date || createdDate;
  
  if (!displayDate) {
    return <span style={{ color: '#94a3b8', fontSize: 13 }}>No date</span>;
  }
  
  const dateObj = new Date(displayDate);
  const now = new Date();
  const daysAgo = Math.floor((now - dateObj) / (1000 * 60 * 60 * 24));
  
  let relativeTime = '';
  if (daysAgo === 0) {
    relativeTime = 'Today';
  } else if (daysAgo === 1) {
    relativeTime = 'Yesterday';
  } else if (daysAgo < 7) {
    relativeTime = `${daysAgo}d ago`;
  } else if (daysAgo < 30) {
    relativeTime = `${Math.floor(daysAgo / 7)}w ago`;
  } else if (daysAgo < 365) {
    relativeTime = `${Math.floor(daysAgo / 30)}mo ago`;
  } else {
    relativeTime = `${Math.floor(daysAgo / 365)}y ago`;
  }
  
  const label = date ? 'Verified' : 'Added';
  
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ color: '#1e293b', fontWeight: 500 }}>
        {dateObj.toLocaleDateString()}
      </div>
      <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
        {label}: {relativeTime}
      </div>
    </div>
  );
}
