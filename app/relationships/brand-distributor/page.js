'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/FormField';

export default function DistributorRelationships() {
  const [brands, setBrands] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [states, setStates] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/brands').then(r => r.json()),
      fetch('/api/suppliers').then(r => r.json()), // still loads suppliers for context
      fetch('/api/states').then(r => r.json()),
      fetch('/api/distributor-supplier-state').then(r => r.json())
    ]).then(([b, s, st, rel]) => {
      setBrands(b); setDistributors(s); setStates(st); setRows(rel);
    });
  }, []);

  const handleVerificationToggle = async (distributorId, supplierId, stateId, currentVerified) => {
    setLoading(true);
    try {
      const response = await fetch('/api/distributor-supplier-state', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          distributor_id: distributorId,
          supplier_id: supplierId,
          state_id: stateId,
          is_verified: !currentVerified
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Update the local state
        setRows(prevRows => 
          prevRows.map(row => 
            row.distributor_id === distributorId && row.supplier_id === supplierId && row.state_id === stateId
              ? { ...row, is_verified: !currentVerified, last_verified_at: new Date().toISOString() }
              : row
          )
        );
        alert('Verification status updated successfully!');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating verification:', error);
      alert('Failed to update verification status');
    } finally {
      setLoading(false);
    }
  };

  const name = (id, list, key, label) =>
    list.find(x => x[key] === id)?.[label] ?? id;

  return (
    <div>
      <h1>Distributor ↔ Supplier ↔ State</h1>
      <p>This table lists all distributor-supplier-state relationships by region.</p>

      <table width="100%" cellPadding="8" style={{ borderCollapse:'collapse', background:'white' }}>
        <thead style={{ background:'#e2e8f0' }}>
          <tr>
            <th>Distributor</th>
            <th>Supplier</th>
            <th>State</th>
            <th>Verified</th>
            <th>Last Verified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.distributor_id + r.supplier_id + r.state_id}>
              <td>{r.core_distributors?.distributor_name || r.distributor_id}</td>
              <td>{r.core_suppliers?.supplier_name || r.supplier_id}</td>
              <td>{r.core_states?.state_name || r.state_id}</td>
              <td>{r.is_verified ? '✅' : '—'}</td>
              <td>
                {r.last_verified_at ? new Date(r.last_verified_at).toLocaleDateString() : '—'}
              </td>
              <td>
                <button
                  onClick={() => handleVerificationToggle(r.distributor_id, r.supplier_id, r.state_id, r.is_verified)}
                  disabled={loading}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    backgroundColor: r.is_verified ? '#ef4444' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {r.is_verified ? 'Unverify' : 'Verify'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
