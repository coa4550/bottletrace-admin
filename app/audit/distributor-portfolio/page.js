'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pgycxpmqnrjsusgoinxz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBneWN4cG1xbnJqc3VzZ29pbnh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNTMxNjIsImV4cCI6MjA3MjgyOTE2Mn0.GB-HMHWn7xy5uoXpHhTv8TBO6CNl3a877K5DBIH7ekE'
);

export default function AuditDistributorPortfolioPage() {
  const [distributors, setDistributors] = useState([]);
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [distributorInfo, setDistributorInfo] = useState(null);
  const [portfolioBrands, setPortfolioBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState(new Set());

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

        // Fetch brands in this distributor's portfolio (with pagination)
        let allRelationships = [];
        let start = 0;
        const pageSize = 1000;
        let hasMore = true;

        console.log('Fetching relationships for distributor:', selectedDistributor);

        while (hasMore) {
          const { data, error } = await supabase
            .from('brand_distributor_state')
            .select('brand_id')
            .eq('distributor_id', selectedDistributor)
            .range(start, start + pageSize - 1);

          if (error) throw error;

          console.log(`Fetched ${data?.length || 0} relationships, page ${start/pageSize + 1}`);

          if (data && data.length > 0) {
            allRelationships = [...allRelationships, ...data];
            start += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        console.log('Total relationships found:', allRelationships.length);

        const brandIds = [...new Set(allRelationships.map(r => r.brand_id))];

        if (brandIds.length === 0) {
          setPortfolioBrands([]);
          return;
        }

        // Fetch brand details
        const { data: brands, error: brandsError } = await supabase
          .from('core_brands')
          .select('*')
          .in('brand_id', brandIds)
          .order('brand_name');

        if (brandsError) throw brandsError;

        // Fetch categories
        const { data: brandCats, error: catsError } = await supabase
          .from('brand_categories')
          .select('brand_id, categories(category_name)')
          .in('brand_id', brandIds);

        if (catsError) throw catsError;

        const { data: brandSubcats, error: subcatsError} = await supabase
          .from('brand_sub_categories')
          .select('brand_id, sub_categories(sub_category_name)')
          .in('brand_id', brandIds);

        if (subcatsError) throw subcatsError;

        const catsMap = {};
        brandCats?.forEach(bc => {
          if (bc.categories && bc.categories.category_name) {
            if (!catsMap[bc.brand_id]) catsMap[bc.brand_id] = [];
            catsMap[bc.brand_id].push(bc.categories.category_name);
          }
        });

        const subcatsMap = {};
        brandSubcats?.forEach(bsc => {
          if (bsc.sub_categories && bsc.sub_categories.sub_category_name) {
            if (!subcatsMap[bsc.brand_id]) subcatsMap[bsc.brand_id] = [];
            subcatsMap[bsc.brand_id].push(bsc.sub_categories.sub_category_name);
          }
        });

        const enrichedBrands = brands.map(brand => ({
          ...brand,
          categories: catsMap[brand.brand_id]?.join(', ') || '',
          sub_categories: subcatsMap[brand.brand_id]?.join(', ') || ''
        }));

        setPortfolioBrands(enrichedBrands);
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

  const handleBrandEdit = async (brandId, field, newValue) => {
    try {
      const { error } = await supabase
        .from('core_brands')
        .update({ [field]: newValue })
        .eq('brand_id', brandId);

      if (error) throw error;
      setPortfolioBrands(prev =>
        prev.map(b => (b.brand_id === brandId ? { ...b, [field]: newValue } : b))
      );
    } catch (err) {
      console.error('Update error:', err.message);
      alert('Failed to update brand.');
    }
  };

  const handleDeleteBrand = async (brandId, brandName) => {
    if (!confirm(`Delete "${brandName}" from the database?\n\nThis will remove the brand and all its relationships permanently.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('core_brands')
        .delete()
        .eq('brand_id', brandId);

      if (error) throw error;

      setPortfolioBrands(prev => prev.filter(b => b.brand_id !== brandId));
      setSelectedBrands(prev => {
        const updated = new Set(prev);
        updated.delete(brandId);
        return updated;
      });
      alert('Brand deleted successfully!');
    } catch (err) {
      console.error('Delete error:', err.message);
      alert('Failed to delete brand: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBrands.size === 0) {
      alert('No brands selected');
      return;
    }

    const brandNames = portfolioBrands
      .filter(b => selectedBrands.has(b.brand_id))
      .map(b => b.brand_name)
      .join('\n• ');

    if (!confirm(`Delete ${selectedBrands.size} brands from the database?\n\n• ${brandNames}\n\nThis will remove all selected brands and their relationships permanently.`)) {
      return;
    }

    try {
      const brandIdsToDelete = Array.from(selectedBrands);
      
      const batchSize = 10;
      for (let i = 0; i < brandIdsToDelete.length; i += batchSize) {
        const batch = brandIdsToDelete.slice(i, i + batchSize);
        const { error } = await supabase
          .from('core_brands')
          .delete()
          .in('brand_id', batch);

        if (error) throw error;
      }

      setPortfolioBrands(prev => prev.filter(b => !selectedBrands.has(b.brand_id)));
      setSelectedBrands(new Set());
      alert(`Successfully deleted ${brandIdsToDelete.length} brands!`);
    } catch (err) {
      console.error('Bulk delete error:', err.message);
      alert('Failed to delete brands: ' + err.message);
    }
  };

  const toggleBrandSelection = (brandId) => {
    setSelectedBrands(prev => {
      const updated = new Set(prev);
      if (updated.has(brandId)) {
        updated.delete(brandId);
      } else {
        updated.add(brandId);
      }
      return updated;
    });
  };

  const toggleSelectAll = () => {
    if (selectedBrands.size === portfolioBrands.length) {
      setSelectedBrands(new Set());
    } else {
      setSelectedBrands(new Set(portfolioBrands.map(b => b.brand_id)));
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
              <div style={{ display: 'flex', gap: 60, alignItems: 'start' }}>
                <div style={{ flex: 1, display: 'grid', gap: 16, maxWidth: 500, minWidth: 0 }}>
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
                
                <div style={{ 
                  width: 200,
                  flexShrink: 0
                }}>
                  <label style={{ display: 'block', fontSize: 14, color: '#475569', fontWeight: 600, marginBottom: 8 }}>
                    Distributor Logo
                  </label>
                  {distributorInfo.distributor_logo_url ? (
                    <div style={{
                      width: '100%',
                      height: 200,
                      border: '2px solid #e2e8f0',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'white',
                      overflow: 'hidden',
                      padding: 16
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
                      width: '100%',
                      height: 200,
                      border: '2px dashed #cbd5e1',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#f8fafc',
                      color: '#94a3b8',
                      fontSize: 13
                    }}>
                      No logo URL set
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, margin: 0, color: '#1e293b' }}>
                Distributor Portfolio ({portfolioBrands.length} brands)
              </h2>
              {selectedBrands.size > 0 && (
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
                  Delete {selectedBrands.size} Selected Brand{selectedBrands.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
            {portfolioBrands.length === 0 ? (
              <p style={{ color: '#64748b' }}>No brands found in this distributor's portfolio.</p>
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
                          checked={selectedBrands.size === portfolioBrands.length && portfolioBrands.length > 0}
                          onChange={toggleSelectAll}
                          style={{ cursor: 'pointer' }}
                          title="Select all brands"
                        />
                      </th>
                      <th style={{ ...headerStyle, width: '20%' }}>Brand Name</th>
                      <th style={{ ...headerStyle, width: '15%' }}>Categories</th>
                      <th style={{ ...headerStyle, width: '15%' }}>Sub-Categories</th>
                      <th style={{ ...headerStyle, width: '20%' }}>Brand URL</th>
                      <th style={{ ...headerStyle, width: '20%' }}>Logo URL</th>
                      <th style={{ ...headerStyle, width: '90px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioBrands.map(brand => (
                      <tr 
                        key={brand.brand_id} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9',
                          background: selectedBrands.has(brand.brand_id) ? '#eff6ff' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedBrands.has(brand.brand_id)}
                            onChange={() => toggleBrandSelection(brand.brand_id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={cellStyle}>
                          <EditableCell
                            value={brand.brand_name}
                            onChange={(val) => handleBrandEdit(brand.brand_id, 'brand_name', val)}
                          />
                        </td>
                        <td style={cellStyle}>{brand.categories || '—'}</td>
                        <td style={cellStyle}>{brand.sub_categories || '—'}</td>
                        <td style={cellStyle}>
                          <EditableCell
                            value={brand.brand_url}
                            onChange={(val) => handleBrandEdit(brand.brand_id, 'brand_url', val)}
                          />
                        </td>
                        <td style={cellStyle}>
                          <EditableCell
                            value={brand.brand_logo_url}
                            onChange={(val) => handleBrandEdit(brand.brand_id, 'brand_logo_url', val)}
                          />
                        </td>
                        <td style={cellStyle}>
                          <button
                            onClick={() => handleDeleteBrand(brand.brand_id, brand.brand_name)}
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
