'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function ImportSupplierPortfolio() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(firstSheet);
      setParsed(json);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/import/supplier-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed })
      });
      
      const result = await response.json();
      setResults(result);
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Import Supplier Portfolio</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>
        Upload a spreadsheet with supplier portfolios. Expected columns: supplier_name, brand_name, state_name (or state_code)
      </p>
      <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
        💡 <strong>Tip:</strong> Use <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>ALL</code> in the state_code column to create relationships for all 50 states + territories automatically.
      </p>

      <div style={{ marginTop: 32 }}>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          style={{
            padding: 8,
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            background: 'white'
          }}
        />
      </div>

      {parsed.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Parsed Rows: {parsed.length}</h3>
          <div style={{ 
            maxHeight: 300, 
            overflow: 'auto', 
            border: '1px solid #e2e8f0', 
            borderRadius: 6,
            marginTop: 12 
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                <tr>
                  {Object.keys(parsed[0]).map(key => (
                    <th key={key} style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 10).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} style={{ padding: 8, fontSize: 14 }}>
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.length > 10 && (
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
              Showing first 10 of {parsed.length} rows
            </p>
          )}

          <button
            onClick={handleImport}
            disabled={loading}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              background: loading ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            {loading ? 'Importing...' : 'Import to Database'}
          </button>
        </div>
      )}

      {results && (
        <div style={{ 
          marginTop: 32, 
          padding: 20, 
          background: '#f0fdf4', 
          border: '1px solid #86efac',
          borderRadius: 8 
        }}>
          <h3 style={{ marginTop: 0, color: '#166534' }}>Import Complete</h3>
          <div style={{ display: 'grid', gap: 8, fontSize: 14, color: '#166534' }}>
            <p>✅ Suppliers created: {results.suppliersCreated}</p>
            <p>✅ Brands created: {results.brandsCreated}</p>
            <p>✅ Relationships created: {results.relationshipsCreated}</p>
            <p>🔄 Relationships re-verified: {results.relationshipsVerified}</p>
            <p>⚠️ Rows skipped: {results.skipped}</p>
            {results.errors && results.errors.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontWeight: 500 }}>Errors:</p>
                {results.errors.map((err, i) => (
                  <p key={i} style={{ color: '#dc2626', fontSize: 13 }}>• {err}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
