'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/FormField';

export default function Page() {
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [states, setStates] = useState([]);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/brands').then(r => r.json()),
      fetch('/api/suppliers').then(r => r.json()),
      fetch('/api/states').then(r => r.json()),
      fetch('/api/brand-supplier-states').then(r => r.json())
    ]).then(([b, s, st, rel]) => {
      setBrands(b); setSuppliers(s); setStates(st); setRows(rel);
    });
  }, []);

  return (
    <div>
      <h1>Brand ↔ Supplier ↔ State</h1>
      <p>This table lists all verified or pending relationships.  
      Use the Bulk page for larger edits.</p>
      <table width="100%" cellPadding="8" style={{borderCollapse:'collapse',background:'white'}}>
        <thead style={{background:'#e2e8f0'}}>
          <tr><th>Brand</th><th>Supplier</th><th>State</th><th>Verified</th><th>Source</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.brand_id + r.supplier_id + r.state_id}>
              <td>{brands.find(b=>b.brand_id===r.brand_id)?.brand_name||r.brand_id}</td>
              <td>{suppliers.find(s=>s.supplier_id===r.supplier_id)?.supplier_name||r.supplier_id}</td>
              <td>{states.find(st=>st.state_id===r.state_id)?.state_name||r.state_id}</td>
              <td>{r.is_verified ? '✅' : '—'}</td>
              <td>{r.relationship_source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
