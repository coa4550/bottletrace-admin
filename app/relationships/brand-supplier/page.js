'use client';
import { useEffect, useState } from 'react';

export default function Page() {
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/brands').then(r => r.json()),
      fetch('/api/suppliers').then(r => r.json()),
      fetch('/api/brand-supplier').then(r => r.json())
    ]).then(([b, s, rel]) => {
      setBrands(b); setSuppliers(s); setRows(rel);
    });
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Brand ↔ Supplier</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>
        This table lists all brand-supplier relationships (nationwide).
      </p>
      <div style={{ marginTop: 24, overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          background: 'white',
          border: '1px solid #e2e8f0'
        }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={headerStyle}>Brand</th>
              <th style={headerStyle}>Supplier</th>
              <th style={headerStyle}>Verified</th>
              <th style={headerStyle}>Last Verified</th>
              <th style={headerStyle}>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.brand_id + r.supplier_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={cellStyle}>{brands.find(b=>b.brand_id===r.brand_id)?.brand_name||r.brand_id}</td>
                <td style={cellStyle}>{suppliers.find(s=>s.supplier_id===r.supplier_id)?.supplier_name||r.supplier_id}</td>
                <td style={cellStyle}>{r.is_verified ? '✅' : '—'}</td>
                <td style={cellStyle}>
                  {r.last_verified_at ? new Date(r.last_verified_at).toLocaleDateString() : '—'}
                </td>
                <td style={cellStyle}>{r.relationship_source || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
