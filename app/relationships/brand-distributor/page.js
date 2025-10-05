'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/FormField';

export default function DistributorRelationships() {
  const [brands, setBrands] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [states, setStates] = useState([]);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/brands').then(r => r.json()),
      fetch('/api/suppliers').then(r => r.json()), // still loads suppliers for context
      fetch('/api/states').then(r => r.json()),
      fetch('/api/brand-distributor-state').then(r => r.json())
    ]).then(([b, s, st, rel]) => {
      setBrands(b); setDistributors(s); setStates(st); setRows(rel);
    });
  }, []);

  const name = (id, list, key, label) =>
    list.find(x => x[key] === id)?.[label] ?? id;

  return (
    <div>
      <h1>Brand ↔ Distributor ↔ State</h1>
      <p>This table lists all distributor relationships by brand and region.</p>

      <table width="100%" cellPadding="8" style={{ borderCollapse:'collapse', background:'white' }}>
        <thead style={{ background:'#e2e8f0' }}>
          <tr><th>Brand</th><th>Distributor</th><th>State</th><th>Verified</th><th>Source</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.brand_id + r.supplier_id + r.state_id}>
              <td>{name(r.brand_id, brands, 'brand_id', 'brand_name')}</td>
              <td>{name(r.supplier_id, distributors, 'supplier_id', 'supplier_name')}</td>
              <td>{name(r.state_id, states, 'state_id', 'state_name')}</td>
              <td>{r.is_verified ? '✅' : '—'}</td>
              <td>{r.relationship_source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
