'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import SearchInput from '@/components/SearchInput';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colWidths, setColWidths] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('supplierColWidths');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [allDistributors, setAllDistributors] = useState([]);
  const [allStates, setAllStates] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch suppliers
        const { data: suppliersData, error: suppliersError } = await supabase
          .from('core_suppliers')
          .select('*')
          .order('supplier_name');

        if (suppliersError) throw suppliersError;

        // Fetch distributors
        const { data: distributorsData, error: distributorsError } = await supabase
          .from('core_distributors')
          .select('distributor_id, distributor_name')
          .order('distributor_name');

        if (distributorsError) throw distributorsError;

        // Fetch states
        const { data: statesData, error: statesError } = await supabase
          .from('core_states')
          .select('state_id, state_name')
          .order('state_name');

        if (statesError) throw statesError;

        // Fetch distributor-supplier-state relationships
        const { data: relationshipsData, error: relationshipsError } = await supabase
          .from('distributor_supplier_state')
          .select('*');

        if (relationshipsError) throw relationshipsError;

        // Create relationship map
        const relationshipMap = {};
        relationshipsData?.forEach(rel => {
          if (!relationshipMap[rel.supplier_id]) {
            relationshipMap[rel.supplier_id] = [];
          }
          relationshipMap[rel.supplier_id].push({
            distributor_id: rel.distributor_id,
            state_id: rel.state_id,
            distributor_name: distributorsData.find(d => d.distributor_id === rel.distributor_id)?.distributor_name || '',
            state_name: statesData.find(s => s.state_id === rel.state_id)?.state_name || '',
            is_verified: rel.is_verified,
            last_verified_at: rel.last_verified_at
          });
        });

        // Enrich suppliers with distributor-state relationships
        const enrichedSuppliers = suppliersData?.map(supplier => ({
          ...supplier,
          distributor_states: relationshipMap[supplier.supplier_id] || []
        })) || [];

        setSuppliers(enrichedSuppliers);
        setAllDistributors(distributorsData || []);
        setAllStates(statesData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const startResize = (e, key) => {
    const startX = e.clientX;
    const startWidth = colWidths[key] || 150;

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(60, startWidth + moveEvent.clientX - startX);
      setColWidths((prev) => {
        const updated = { ...prev, [key]: newWidth };
        localStorage.setItem('supplierColWidths', JSON.stringify(updated));
        return updated;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleEdit = async (supplierId, field, newValue) => {
    try {
      const { error } = await supabase
        .from('core_suppliers')
        .update({ [field]: newValue })
        .eq('supplier_id', supplierId);

      if (error) throw error;
      setSuppliers((prev) =>
        prev.map((s) => (s.supplier_id === supplierId ? { ...s, [field]: newValue } : s))
      );
    } catch (err) {
      console.error('Update error:', err.message);
      alert('Failed to update Supabase.');
    }
  };

  const handleDistributorStateReassignment = async (supplierId, currentDistributorId, currentStateId, newDistributorId, newStateId) => {
    try {
      // Delete existing relationship
      const { error: deleteError } = await supabase
        .from('distributor_supplier_state')
        .delete()
        .eq('supplier_id', supplierId)
        .eq('distributor_id', currentDistributorId)
        .eq('state_id', currentStateId);

      if (deleteError) throw deleteError;

      // Insert new relationship if distributor and state are selected
      if (newDistributorId && newStateId) {
        const { error: insertError } = await supabase
          .from('distributor_supplier_state')
          .insert({
            supplier_id: supplierId,
            distributor_id: newDistributorId,
            state_id: newStateId,
            is_verified: false,
            last_verified_at: null,
            relationship_source: 'supplier_page_update'
          });

        if (insertError) throw insertError;
      }

      // Refresh data to get updated relationships
      const { data: relationshipsData, error: relationshipsError } = await supabase
        .from('distributor_supplier_state')
        .select('*')
        .eq('supplier_id', supplierId);

      if (relationshipsError) throw relationshipsError;

      // Update local state
      const updatedRelationships = relationshipsData?.map(rel => ({
        distributor_id: rel.distributor_id,
        state_id: rel.state_id,
        distributor_name: allDistributors.find(d => d.distributor_id === rel.distributor_id)?.distributor_name || '',
        state_name: allStates.find(s => s.state_id === rel.state_id)?.state_name || '',
        is_verified: rel.is_verified,
        last_verified_at: rel.last_verified_at
      })) || [];

      setSuppliers(prev =>
        prev.map(s => s.supplier_id === supplierId ? { 
          ...s, 
          distributor_states: updatedRelationships 
        } : s)
      );

      const newDistributorName = allDistributors.find(d => d.distributor_id === newDistributorId)?.distributor_name || '';
      const newStateName = allStates.find(s => s.state_id === newStateId)?.state_name || '';
      
      if (newDistributorId && newStateId) {
        alert(`Supplier reassigned to ${newDistributorName} in ${newStateName}`);
      } else {
        alert('Supplier relationship removed');
      }
    } catch (err) {
      console.error('Distributor reassignment error:', err.message);
      alert('Failed to reassign supplier: ' + err.message);
    }
  };

  const columns = [
    { key: 'supplier_name', label: 'Supplier Name', editable: true },
    { key: 'supplier_url', label: 'Website', editable: true },
    { key: 'supplier_logo_url', label: 'Logo URL', editable: true },
    { key: 'distributor_states', label: 'Distributor & State', editable: false, special: true },
  ];

  // Filter suppliers based on search term
  const filteredSuppliers = suppliers.filter(supplier => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      supplier.supplier_name?.toLowerCase().includes(searchLower) ||
      supplier.supplier_url?.toLowerCase().includes(searchLower)
    );
  });

  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    const { key, direction } = sortConfig;
    if (!key) return 0;
    const aVal = a[key] ?? '';
    const bVal = b[key] ?? '';
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key)
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: 'asc' };
    });
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 16 }}>Suppliers ({suppliers.length})</h1>
      <div style={{ marginBottom: 16 }}>
        <SearchInput 
          placeholder="Search suppliers..." 
          onSearch={setSearchTerm}
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            tableLayout: 'auto',
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          <thead style={{ background: '#f1f5f9' }}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: colWidths[col.key] || 150,
                    position: 'relative',
                    borderRight: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortConfig.key === col.key && (
                    <span style={{ marginLeft: 4 }}>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                  <div
                    onMouseDown={(e) => startResize(e, col.key)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      height: '100%',
                      width: '5px',
                      cursor: 'col-resize',
                      background: 'transparent',
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedSuppliers.map((s) => (
              <tr key={s.supplier_id}>
                {columns.map((col) => {
                  const value = s[col.key];
                  const editable = col.editable;
                  const special = col.special;

                  if (special && col.key === 'distributor_states') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        <DistributorStateCell
                          distributorStates={s.distributor_states || []}
                          allDistributors={allDistributors}
                          allStates={allStates}
                          supplierId={s.supplier_id}
                          onReassign={handleDistributorStateReassignment}
                        />
                      </td>
                    );
                  }

                  if (editable)
                    return (
                      <td key={col.key} style={cellStyle}>
                        <EditableCell
                          value={value}
                          onChange={(val) => handleEdit(s.supplier_id, col.key, val)}
                        />
                      </td>
                    );

                  return (
                    <td key={col.key} style={cellStyle}>
                      {value || '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellStyle = {
  padding: '8px 12px',
  borderBottom: '1px solid #f1f5f9',
  whiteSpace: 'nowrap',
  maxWidth: 400,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function EditableCell({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value || '');

  const handleBlur = () => {
    setEditing(false);
    if (temp !== value) onChange(temp);
  };

  if (editing)
    return (
      <input
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={handleBlur}
        autoFocus
        style={{
          width: '100%',
          padding: 4,
          border: '1px solid #cbd5e1',
          borderRadius: 4,
        }}
      />
    );

  return (
    <div
      onClick={() => setEditing(true)}
      style={{ cursor: 'text', minWidth: 80 }}
      title="Click to edit"
    >
      {value || '—'}
    </div>
  );
}

function DistributorStateCell({ distributorStates, allDistributors, allStates, supplierId, onReassign }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState(null);

  const handleReassignClick = (relationship) => {
    setSelectedRelationship(relationship);
    setShowModal(true);
  };

  if (distributorStates.length === 0) {
    return (
      <div style={{ color: '#94a3b8', fontSize: 13 }}>
        No distributor relationships
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 300 }}>
      {distributorStates.map((rel, index) => (
        <div key={index} style={{ marginBottom: 8 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            padding: '4px 8px',
            background: '#f8fafc',
            borderRadius: 4,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>
                {rel.distributor_name || 'Unknown Distributor'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {rel.state_name || 'Unknown State'}
              </div>
            </div>
            <button
              onClick={() => handleReassignClick(rel)}
              style={{
                padding: '2px 8px',
                fontSize: 11,
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer'
              }}
            >
              Reassign
            </button>
          </div>
        </div>
      ))}
      
      {showModal && (
        <DistributorStateReassignmentModal
          relationship={selectedRelationship}
          allDistributors={allDistributors}
          allStates={allStates}
          supplierId={supplierId}
          onReassign={onReassign}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function DistributorStateReassignmentModal({ relationship, allDistributors, allStates, supplierId, onReassign, onClose }) {
  const [selectedDistributorId, setSelectedDistributorId] = useState(relationship?.distributor_id || '');
  const [selectedStateId, setSelectedStateId] = useState(relationship?.state_id || '');
  const [distributorSearch, setDistributorSearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');

  const filteredDistributors = allDistributors.filter(d =>
    d.distributor_name.toLowerCase().includes(distributorSearch.toLowerCase())
  );

  const filteredStates = allStates.filter(s =>
    s.state_name.toLowerCase().includes(stateSearch.toLowerCase())
  );

  const handleConfirm = () => {
    onReassign(
      supplierId,
      relationship.distributor_id,
      relationship.state_id,
      selectedDistributorId,
      selectedStateId
    );
    onClose();
  };

  const handleRemove = () => {
    onReassign(
      supplierId,
      relationship.distributor_id,
      relationship.state_id,
      null,
      null
    );
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        padding: 24,
        width: '90%',
        maxWidth: 500,
        maxHeight: '80vh',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#1e293b' }}>
            Reassign Supplier Relationship
          </h2>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: 14 }}>
            Current: {relationship?.distributor_name} in {relationship?.state_name}
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#374151' }}>
            Select New Distributor:
          </h3>
          <input
            type="text"
            placeholder="Search distributors..."
            value={distributorSearch}
            onChange={(e) => setDistributorSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: 14,
              marginBottom: 8
            }}
          />
          <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
            {filteredDistributors.map(distributor => (
              <div
                key={distributor.distributor_id}
                onClick={() => setSelectedDistributorId(distributor.distributor_id)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  background: distributor.distributor_id === selectedDistributorId ? '#eff6ff' : 'transparent'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.target.style.background = distributor.distributor_id === selectedDistributorId ? '#eff6ff' : 'transparent'}
              >
                {distributor.distributor_name}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#374151' }}>
            Select New State:
          </h3>
          <input
            type="text"
            placeholder="Search states..."
            value={stateSearch}
            onChange={(e) => setStateSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: 14,
              marginBottom: 8
            }}
          />
          <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
            {filteredStates.map(state => (
              <div
                key={state.state_id}
                onClick={() => setSelectedStateId(state.state_id)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  background: state.state_id === selectedStateId ? '#eff6ff' : 'transparent'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.target.style.background = state.state_id === selectedStateId ? '#eff6ff' : 'transparent'}
              >
                {state.state_name}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <button
            onClick={handleRemove}
            style={{
              padding: '8px 16px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            Remove Relationship
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedDistributorId || !selectedStateId}
              style={{
                padding: '8px 16px',
                background: (!selectedDistributorId || !selectedStateId) ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: (!selectedDistributorId || !selectedStateId) ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 500
              }}
            >
              Reassign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
