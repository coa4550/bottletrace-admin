'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AuditSupplierPortfolioPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierInfo, setSupplierInfo] = useState(null);
  const [portfolioBrands, setPortfolioBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState(new Set());

  // Fetch all suppliers on mount
  useEffect(() => {
    async function fetchSuppliers() {
      const { data, error } = await supabase
        .from('core_suppliers')
        .select('supplier_id, supplier_name')
        .order('supplier_name');
      
      if (error) {
        console.error('Error fetching suppliers:', error);
      } else {
        setSuppliers(data || []);
        
        // Check for duplicate supplier names
        const nameCounts = {};
        const suppliersByName = {};
        data?.forEach(s => {
          nameCounts[s.supplier_name] = (nameCounts[s.supplier_name] || 0) + 1;
          if (!suppliersByName[s.supplier_name]) {
            suppliersByName[s.supplier_name] = [];
          }
          suppliersByName[s.supplier_name].push(s.supplier_id);
        });
        const duplicates = Object.entries(nameCounts).filter(([name, count]) => count > 1);
        if (duplicates.length > 0) {
          console.warn('⚠️ DUPLICATE SUPPLIER NAMES FOUND:', duplicates);
          duplicates.forEach(([name, count]) => {
            console.warn(`  "${name}" has ${count} entries with IDs:`, suppliersByName[name]);
          });
        }
        
        // Check specifically for Hotaling
        const hotalingSuppliers = data?.filter(s => s.supplier_name.includes('Hotaling'));
        if (hotalingSuppliers && hotalingSuppliers.length > 0) {
          console.log('🔍 Hotaling suppliers found:', hotalingSuppliers);
        }
      }
    }
    fetchSuppliers();
  }, []);

  // Fetch supplier details and portfolio when a supplier is selected
  useEffect(() => {
    if (!selectedSupplier) return;

    async function fetchSupplierData() {
      setLoading(true);
      try {
        // Fetch supplier info
        const { data: supplier, error: supplierError } = await supabase
          .from('core_suppliers')
          .select('*')
          .eq('supplier_id', selectedSupplier)
          .single();

        if (supplierError) throw supplierError;
        setSupplierInfo(supplier);

        // Fetch brands in this supplier's portfolio
        console.log(`Fetching relationships for supplier: ${selectedSupplier}`);
        console.log(`Supplier name: ${supplier.supplier_name}`);

        const { data: relationships, error: relError } = await supabase
          .from('brand_supplier')
          .select('*')
          .eq('supplier_id', selectedSupplier);

        if (relError) {
          console.error('Error fetching relationships:', relError);
          throw relError;
        }

        console.log(`Total relationships fetched: ${relationships?.length || 0}`);
        console.log('Sample relationships:', relationships?.slice(0, 3));

        // Create relationship map with confidence scores
        const relationshipMap = {};
        relationships?.forEach(rel => {
          relationshipMap[rel.brand_id] = {
            ...rel,
            confidence_score: calculateConfidenceScore(rel)
          };
        });

        // Get brand IDs
        const brandIds = relationships?.map(r => r.brand_id) || [];
        
        console.log(`Brand IDs: ${brandIds.length}`, brandIds);

        if (brandIds.length === 0) {
          setPortfolioBrands([]);
          return;
        }

        // Fetch brand details for all brands in portfolio
        const { data: brands, error: brandsError } = await supabase
          .from('core_brands')
          .select('*')
          .in('brand_id', brandIds)
          .order('brand_name');

        if (brandsError) throw brandsError;

        // Fetch categories for these brands
        const { data: brandCats, error: catsError } = await supabase
          .from('brand_categories')
          .select('brand_id, categories(category_name)')
          .in('brand_id', brandIds);

        if (catsError) throw catsError;

        // Fetch sub-categories for these brands
        const { data: brandSubcats, error: subcatsError } = await supabase
          .from('brand_sub_categories')
          .select('brand_id, sub_categories(sub_category_name)')
          .in('brand_id', brandIds);

        if (subcatsError) throw subcatsError;

        // Create lookup maps
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

        // Merge data
        const enrichedBrands = brands.map(brand => ({
          ...brand,
          categories: catsMap[brand.brand_id]?.join(', ') || '',
          sub_categories: subcatsMap[brand.brand_id]?.join(', ') || '',
          confidence_score: relationshipMap[brand.brand_id]?.confidence_score || 0,
          relationship_source: relationshipMap[brand.brand_id]?.relationship_source || '',
          is_verified: relationshipMap[brand.brand_id]?.is_verified || false,
          admin_verified_at: relationshipMap[brand.brand_id]?.admin_verified_at || null
        }));

        setPortfolioBrands(enrichedBrands);
      } catch (error) {
        console.error('Error fetching supplier data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSupplierData();
  }, [selectedSupplier]);

  const handleSupplierInfoEdit = async (field, newValue) => {
    try {
      const { error } = await supabase
        .from('core_suppliers')
        .update({ [field]: newValue })
        .eq('supplier_id', selectedSupplier);

      if (error) throw error;
      setSupplierInfo(prev => ({ ...prev, [field]: newValue }));
    } catch (err) {
      console.error('Update error:', err.message);
      alert('Failed to update supplier info.');
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

  const handleRemoveRelationship = async (brandId, brandName) => {
    if (!confirm(`Remove relationship between "${brandName}" and "${supplierInfo.supplier_name}"?\n\nThis will remove the brand from this supplier's portfolio. If this is the brand's only supplier, the brand will be marked as orphaned.`)) {
      return;
    }

    try {
      // Remove the brand-supplier relationship
      const { error: deleteError } = await supabase
        .from('brand_supplier')
        .delete()
        .eq('brand_id', brandId)
        .eq('supplier_id', selectedSupplier);

      if (deleteError) throw deleteError;

      // Check if the brand has any other suppliers
      const { data: remainingRelationships, error: checkError } = await supabase
        .from('brand_supplier')
        .select('supplier_id')
        .eq('brand_id', brandId);

      if (checkError) throw checkError;

      // If no other suppliers exist, mark the brand as orphaned
      if (!remainingRelationships || remainingRelationships.length === 0) {
        const { error: orphanError } = await supabase
          .from('core_brands')
          .update({
            is_orphaned: true,
            orphaned_at: new Date().toISOString(),
            orphaned_reason: 'supplier_removed'
          })
          .eq('brand_id', brandId);

        if (orphanError) throw orphanError;
      }

      // Update UI
      setPortfolioBrands(prev => prev.filter(b => b.brand_id !== brandId));
      setSelectedBrands(prev => {
        const updated = new Set(prev);
        updated.delete(brandId);
        return updated;
      });
      
      const orphanedMsg = (!remainingRelationships || remainingRelationships.length === 0) 
        ? ' The brand has been marked as orphaned.' 
        : '';
      alert(`Relationship removed successfully!${orphanedMsg}`);
    } catch (err) {
      console.error('Remove relationship error:', err.message);
      alert('Failed to remove relationship: ' + err.message);
    }
  };

  const handleBulkRemoveRelationships = async () => {
    if (selectedBrands.size === 0) {
      alert('No brands selected');
      return;
    }

    const brandNames = portfolioBrands
      .filter(b => selectedBrands.has(b.brand_id))
      .map(b => b.brand_name)
      .join('\n• ');

    if (!confirm(`Remove ${selectedBrands.size} brand relationships from "${supplierInfo.supplier_name}"?\n\n• ${brandNames}\n\nBrands will be marked as orphaned if this is their only supplier.`)) {
      return;
    }

    try {
      const brandIdsToRemove = Array.from(selectedBrands);
      let orphanedCount = 0;
      
      // Process each brand
      for (const brandId of brandIdsToRemove) {
        // Remove the brand-supplier relationship
        const { error: deleteError } = await supabase
          .from('brand_supplier')
          .delete()
          .eq('brand_id', brandId)
          .eq('supplier_id', selectedSupplier);

        if (deleteError) throw deleteError;

        // Check if the brand has any other suppliers
        const { data: remainingRelationships, error: checkError } = await supabase
          .from('brand_supplier')
          .select('supplier_id')
          .eq('brand_id', brandId);

        if (checkError) throw checkError;

        // If no other suppliers exist, mark the brand as orphaned
        if (!remainingRelationships || remainingRelationships.length === 0) {
          const { error: orphanError } = await supabase
            .from('core_brands')
            .update({
              is_orphaned: true,
              orphaned_at: new Date().toISOString(),
              orphaned_reason: 'supplier_removed'
            })
            .eq('brand_id', brandId);

          if (orphanError) throw orphanError;
          orphanedCount++;
        }
      }

      setPortfolioBrands(prev => prev.filter(b => !selectedBrands.has(b.brand_id)));
      setSelectedBrands(new Set());
      
      const orphanedMsg = orphanedCount > 0 
        ? ` ${orphanedCount} brand${orphanedCount > 1 ? 's were' : ' was'} marked as orphaned.` 
        : '';
      alert(`Successfully removed ${brandIdsToRemove.length} relationship${brandIdsToRemove.length > 1 ? 's' : ''}!${orphanedMsg}`);
    } catch (err) {
      console.error('Bulk remove error:', err.message);
      alert('Failed to remove relationships: ' + err.message);
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
      <h1>Audit Supplier Portfolio</h1>
      
      {/* Supplier Selector */}
      <div style={{ marginTop: 24, marginBottom: 32 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
          Select Supplier:
        </label>
        <select
          value={selectedSupplier || ''}
          onChange={(e) => setSelectedSupplier(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            minWidth: 300,
            background: 'white'
          }}
        >
          <option value="">-- Choose a supplier --</option>
          {suppliers.map(s => (
            <option key={s.supplier_id} value={s.supplier_id}>
              {s.supplier_name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Loading supplier data...</p>}

      {!loading && selectedSupplier && supplierInfo && (
        <>
          {/* Supplier Info Section */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 20, marginBottom: 16, color: '#1e293b' }}>Supplier Information</h2>
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
                      Supplier Name
                    </label>
                    <EditableInput
                      value={supplierInfo.supplier_name}
                      onChange={(val) => handleSupplierInfoEdit('supplier_name', val)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                      Supplier URL
                    </label>
                    <EditableInput
                      value={supplierInfo.supplier_url}
                      onChange={(val) => handleSupplierInfoEdit('supplier_url', val)}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                    Supplier Logo
                  </label>
                  {supplierInfo.supplier_logo_url ? (
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
                        src={supplierInfo.supplier_logo_url} 
                        alt={supplierInfo.supplier_name}
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '100%',
                          objectFit: 'contain'
                        }}
                        onError={(e) => {
                          console.error('Failed to load logo:', supplierInfo.supplier_logo_url);
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
                  Supplier Logo URL
                </label>
                <EditableInput
                  value={supplierInfo.supplier_logo_url}
                  onChange={(val) => handleSupplierInfoEdit('supplier_logo_url', val)}
                />
              </div>
            </div>
          </div>

          {/* Portfolio Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, margin: 0, color: '#1e293b' }}>
                Supplier Portfolio ({portfolioBrands.length} brands)
              </h2>
              {selectedBrands.size > 0 && (
                <button
                  onClick={handleBulkRemoveRelationships}
                  style={{
                    padding: '8px 16px',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: 14
                  }}
                >
                  Remove {selectedBrands.size} Relationship{selectedBrands.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
            {portfolioBrands.length === 0 ? (
              <p style={{ color: '#64748b' }}>No brands found in this supplier's portfolio.</p>
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
                      <th style={{ ...headerStyle, width: '14%' }}>Brand Name</th>
                      <th style={{ ...headerStyle, width: '9%' }}>Confidence</th>
                      <th style={{ ...headerStyle, width: '11%' }}>Verified Date</th>
                      <th style={{ ...headerStyle, width: '11%' }}>Categories</th>
                      <th style={{ ...headerStyle, width: '11%' }}>Sub-Categories</th>
                      <th style={{ ...headerStyle, width: '16%' }}>Brand URL</th>
                      <th style={{ ...headerStyle, width: '16%' }}>Logo URL</th>
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
                        <td style={cellStyle}>
                          <ConfidenceScoreBadge 
                            score={brand.confidence_score} 
                            isVerified={brand.is_verified}
                            source={brand.relationship_source}
                            verifiedAt={brand.admin_verified_at}
                          />
                        </td>
                        <td style={cellStyle}>
                          <VerifiedDate date={brand.admin_verified_at} />
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
                            onClick={() => handleRemoveRelationship(brand.brand_id, brand.brand_name)}
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
                            Remove
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

      {!selectedSupplier && !loading && (
        <p style={{ color: '#64748b', marginTop: 40 }}>
          Please select a supplier to view and audit their portfolio.
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

// Calculate confidence score based on relationship metadata
function calculateConfidenceScore(relationship) {
  let score = 0.50; // Base score
  
  // Admin verified relationships get highest confidence
  if (relationship.admin_verified_at) {
    score = 0.95;
    
    // Apply time decay - reduce confidence over time
    const verifiedDate = new Date(relationship.admin_verified_at);
    const now = new Date();
    const monthsOld = (now - verifiedDate) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsOld > 12) {
      score -= 0.10; // 1+ year old: reduce by 10%
    } else if (monthsOld > 6) {
      score -= 0.05; // 6+ months old: reduce by 5%
    }
  } else if (relationship.is_verified) {
    score = 0.85; // Verified but no admin timestamp
  } else if (relationship.relationship_source === 'csv_import' || relationship.relationship_source === 'import') {
    score = 0.70; // Imported data
  } else if (relationship.relationship_source === 'user_submission') {
    score = 0.60; // User submitted (not yet verified)
  }
  
  return Math.max(0, Math.min(1, score)); // Clamp between 0 and 1
}

// Component to display confidence score as a badge
function ConfidenceScoreBadge({ score, isVerified, source, verifiedAt }) {
  const percentage = Math.round(score * 100);
  
  // Determine color based on score
  let bgColor, textColor;
  if (percentage >= 90) {
    bgColor = '#dcfce7'; // green-100
    textColor = '#166534'; // green-800
  } else if (percentage >= 75) {
    bgColor = '#dbeafe'; // blue-100
    textColor = '#1e40af'; // blue-800
  } else if (percentage >= 60) {
    bgColor = '#fef3c7'; // amber-100
    textColor = '#92400e'; // amber-800
  } else {
    bgColor = '#fee2e2'; // red-100
    textColor = '#991b1b'; // red-800
  }
  
  const tooltipParts = [
    `Confidence: ${percentage}%`,
    isVerified ? '✓ Verified' : '✗ Not verified',
    source ? `Source: ${source}` : null,
    verifiedAt ? `Verified: ${new Date(verifiedAt).toLocaleDateString()}` : null
  ].filter(Boolean);
  
  return (
    <div
      style={{
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: 4,
        background: bgColor,
        color: textColor,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'help'
      }}
      title={tooltipParts.join('\n')}
    >
      {percentage}%
    </div>
  );
}

// Component to display verified date
function VerifiedDate({ date }) {
  if (!date) {
    return <span style={{ color: '#94a3b8', fontSize: 13 }}>Not verified</span>;
  }
  
  const verifiedDate = new Date(date);
  const now = new Date();
  const daysAgo = Math.floor((now - verifiedDate) / (1000 * 60 * 60 * 24));
  
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
  
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ color: '#1e293b', fontWeight: 500 }}>
        {verifiedDate.toLocaleDateString()}
      </div>
      <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
        {relativeTime}
      </div>
    </div>
  );
}
