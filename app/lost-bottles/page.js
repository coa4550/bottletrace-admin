'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LostBottlesPage() {
  const [activeTab, setActiveTab] = useState('brands');
  const [orphanedBrands, setOrphanedBrands] = useState([]);
  const [orphanedSuppliers, setOrphanedSuppliers] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [allDistributors, setAllDistributors] = useState([]);
  const [allStates, setAllStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchOrphanedBrands(),
        fetchOrphanedSuppliers(),
        fetchAllSuppliers(),
        fetchAllDistributors(),
        fetchAllStates()
      ]);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      alert('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrphanedBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('core_brands')
        .select('*')
        .eq('is_orphaned', true)
        .order('orphaned_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setOrphanedBrands(data || []);
    } catch (error) {
      console.error('Error fetching orphaned brands:', error);
      throw error;
    }
  };

  const fetchOrphanedSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('core_suppliers')
        .select('*')
        .eq('is_orphaned', true)
        .order('orphaned_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setOrphanedSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching orphaned suppliers:', error);
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

  const fetchAllStates = async () => {
    try {
      const { data, error } = await supabase
        .from('core_states')
        .select('state_id, state_name, state_code')
        .order('state_name');
      
      if (error) throw error;
      setAllStates(data || []);
    } catch (error) {
      console.error('Error fetching states:', error);
      throw error;
    }
  };

  const handleSubmitBrandSuggestion = async (brand, supplierId, additionalNotes) => {
    if (!supplierId) {
      alert('Please select a supplier');
      return;
    }

    const supplier = allSuppliers.find(s => s.supplier_id === supplierId);
    
    if (!confirm(`Submit suggestion to link "${brand.brand_name}" to "${supplier?.supplier_name}"?\n\nThis will be sent to BottleTrace admins for approval.`)) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_type: 'Orphan_Correction',
          brand_category: 'brand_supplier',
          payload: {
            orphaned_brand_id: brand.brand_id,
            orphaned_brand_name: brand.brand_name,
            suggested_supplier_id: supplierId,
            suggested_supplier_name: supplier.supplier_name,
            reason: additionalNotes || 'User-submitted orphan correction'
          },
          additional_notes: additionalNotes
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit suggestion');
      }

      alert('Thank you! Your suggestion has been submitted for admin review.');
      // Refresh the orphaned brands list
      await fetchOrphanedBrands();
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      alert('Failed to submit suggestion: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSupplierSuggestion = async (supplier, distributorId, stateId, additionalNotes) => {
    if (!distributorId || !stateId) {
      alert('Please select both a distributor and a state');
      return;
    }

    const distributor = allDistributors.find(d => d.distributor_id === distributorId);
    const state = allStates.find(s => s.state_id === stateId);
    
    if (!confirm(`Submit suggestion to link "${supplier.supplier_name}" to "${distributor?.distributor_name}" in ${state?.state_name}?\n\nThis will be sent to BottleTrace admins for approval.`)) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_type: 'Orphan_Correction',
          brand_category: 'supplier_distributor',
          payload: {
            orphaned_supplier_id: supplier.supplier_id,
            orphaned_supplier_name: supplier.supplier_name,
            suggested_distributor_id: distributorId,
            suggested_distributor_name: distributor.distributor_name,
            suggested_state_id: stateId,
            suggested_state_name: state.state_name,
            reason: additionalNotes || 'User-submitted orphan correction'
          },
          additional_notes: additionalNotes
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit suggestion');
      }

      alert('Thank you! Your suggestion has been submitted for admin review.');
      // Refresh the orphaned suppliers list
      await fetchOrphanedSuppliers();
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      alert('Failed to submit suggestion: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading lost bottles...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Lost Bottles</h1>
      <p style={{ color: '#64748b', marginTop: 8, marginBottom: 24 }}>
        Help us connect orphaned brands and suppliers! These records exist in our database but are missing key relationships.
        Submit your suggestions and our admin team will review them.
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
          Brands Without Suppliers ({orphanedBrands.length})
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
          Suppliers Without Distributors ({orphanedSuppliers.length})
        </button>
      </div>

      {/* Brands Tab Content */}
      {activeTab === 'brands' && (
        <>
          {orphanedBrands.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>No orphaned brands found. Great job!</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {orphanedBrands.map(brand => (
                <BrandSuggestionCard
                  key={brand.brand_id}
                  brand={brand}
                  allSuppliers={allSuppliers}
                  onSubmit={handleSubmitBrandSuggestion}
                  submitting={submitting}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Suppliers Tab Content */}
      {activeTab === 'suppliers' && (
        <>
          {orphanedSuppliers.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>No orphaned suppliers found. Great job!</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {orphanedSuppliers.map(supplier => (
                <SupplierSuggestionCard
                  key={supplier.supplier_id}
                  supplier={supplier}
                  allDistributors={allDistributors}
                  allStates={allStates}
                  onSubmit={handleSubmitSupplierSuggestion}
                  submitting={submitting}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BrandSuggestionCard({ brand, allSuppliers, onSubmit, submitting }) {
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <div style={{
      padding: 20,
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      display: 'grid',
      gap: 12
    }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 18 }}>{brand.brand_name}</h3>
        {brand.brand_url && (
          <a 
            href={brand.brand_url} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', fontSize: 14, textDecoration: 'none' }}
          >
            Visit Website →
          </a>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ fontSize: 14, fontWeight: 500 }}>
          Suggest a Supplier:
        </label>
        <select
          value={selectedSupplier}
          onChange={(e) => setSelectedSupplier(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #cbd5e1',
            borderRadius: 4,
            background: 'white'
          }}
        >
          <option value="">Select Supplier...</option>
          {allSuppliers.map(supplier => (
            <option key={supplier.supplier_id} value={supplier.supplier_id}>
              {supplier.supplier_name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ fontSize: 14, fontWeight: 500 }}>
          Additional Notes (Optional):
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional context or information..."
          rows={2}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #cbd5e1',
            borderRadius: 4,
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
      </div>

      <button
        onClick={() => onSubmit(brand, selectedSupplier, notes)}
        disabled={!selectedSupplier || submitting}
        style={{
          padding: '10px 16px',
          fontSize: 14,
          fontWeight: 500,
          color: 'white',
          background: selectedSupplier && !submitting ? '#3b82f6' : '#cbd5e1',
          border: 'none',
          borderRadius: 6,
          cursor: selectedSupplier && !submitting ? 'pointer' : 'not-allowed'
        }}
      >
        {submitting ? 'Submitting...' : 'Submit Suggestion'}
      </button>
    </div>
  );
}

function SupplierSuggestionCard({ supplier, allDistributors, allStates, onSubmit, submitting }) {
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <div style={{
      padding: 20,
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      display: 'grid',
      gap: 12
    }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 18 }}>{supplier.supplier_name}</h3>
        {supplier.supplier_url && (
          <a 
            href={supplier.supplier_url} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', fontSize: 14, textDecoration: 'none' }}
          >
            Visit Website →
          </a>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>
            Suggest a Distributor:
          </label>
          <select
            value={selectedDistributor}
            onChange={(e) => setSelectedDistributor(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: 14,
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              background: 'white'
            }}
          >
            <option value="">Select Distributor...</option>
            {allDistributors.map(distributor => (
              <option key={distributor.distributor_id} value={distributor.distributor_id}>
                {distributor.distributor_name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 500 }}>
            In State:
          </label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: 14,
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              background: 'white'
            }}
          >
            <option value="">Select State...</option>
            {allStates.map(state => (
              <option key={state.state_id} value={state.state_id}>
                {state.state_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ fontSize: 14, fontWeight: 500 }}>
          Additional Notes (Optional):
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional context or information..."
          rows={2}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #cbd5e1',
            borderRadius: 4,
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
      </div>

      <button
        onClick={() => onSubmit(supplier, selectedDistributor, selectedState, notes)}
        disabled={!selectedDistributor || !selectedState || submitting}
        style={{
          padding: '10px 16px',
          fontSize: 14,
          fontWeight: 500,
          color: 'white',
          background: selectedDistributor && selectedState && !submitting ? '#3b82f6' : '#cbd5e1',
          border: 'none',
          borderRadius: 6,
          cursor: selectedDistributor && selectedState && !submitting ? 'pointer' : 'not-allowed'
        }}
      >
        {submitting ? 'Submitting...' : 'Submit Suggestion'}
      </button>
    </div>
  );
}

