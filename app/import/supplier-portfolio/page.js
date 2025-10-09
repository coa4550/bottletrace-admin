'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function ImportSupplierPortfolio() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [validation, setValidation] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [brandMatches, setBrandMatches] = useState({});

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setValidation(null);
    setResults(null);
    setBrand

Matches({});
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

  const handleValidate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/import/supplier-portfolio/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed })
      });
      
      const result = await response.json();
      setValidation(result);
      
      // Initialize brand matches with defaults
      const matches = {};
      result.supplierReviews?.forEach(sr => {
        sr.importBrands?.forEach(brand => {
          matches[brand.rowIndex] = {
            useExisting: brand.matchType !== 'new',
            existingBrandId: brand.matchedBrand?.brand_id,
            existingBrandName: brand.matchedBrand?.brand_name
          };
        });
      });
      setBrandMatches(matches);
    } catch (error) {
      console.error('Validation error:', error);
      alert('Validation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/import/supplier-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rows: parsed,
          confirmedMatches: brandMatches
        })
      });
      
      const result = await response.json();
      setResults(result);
      setValidation(null);
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateMatch = (rowIndex, useExisting, brandId = null, brandName = null) => {
    setBrandMatches(prev => ({
      ...prev,
      [rowIndex]: {
        useExisting,
        existingBrandId: brandId,
        existingBrandName: brandName
      }
    }));
  };

  const getStatusBadge = (brand) => {
    if (brand.matchType === 'exact') {
      return <span style={{ padding: '2px 8px', background: '#d1fae5', color: '#065f46', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>✓ Exact Match</span>;
    } else if (brand.matchType === 'fuzzy') {
      return <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>~ Fuzzy ({Math.round(brand.similarity * 100)}%)</span>;
    } else {
      return <span style={{ padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>+ New Brand</span>;
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

      {parsed.length > 0 && !validation && !results && (
        <div style={{ marginTop: 24 }}>
          <h3>Parsed Rows: {parsed.length}</h3>
          <button
            onClick={handleValidate}
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
            {loading ? 'Validating...' : 'Validate & Review Changes'}
          </button>
        </div>
      )}

      {validation && validation.supplierReviews && (
        <div style={{ marginTop: 32 }}>
          <h2>Review Import Changes</h2>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            Review all brands below. You can manually adjust matches before importing.
          </p>

          {validation.supplierReviews.map((supplier, idx) => (
            <div key={idx} style={{ marginBottom: 40 }}>
              <h3 style={{ 
                padding: '12px 16px', 
                background: '#1e293b', 
                color: 'white',
                borderRadius: '8px 8px 0 0',
                margin: 0
              }}>
                {supplier.supplierName}
              </h3>

              {/* Import Brands */}
              {supplier.importBrands.length > 0 && (
                <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                  <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <strong>Brands in Import ({supplier.importBrands.length})</strong>
                  </div>
                  {supplier.importBrands.map((brand, brandIdx) => (
                    <div key={brandIdx} style={{ 
                      padding: '12px 16px', 
                      borderBottom: '1px solid #f1f5f9',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 16,
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                          <strong>{brand.brandName}</strong>
                          {getStatusBadge(brand)}
                          <span style={{ fontSize: 13, color: '#64748b' }}>State: {brand.stateCode}</span>
                        </div>
                        {brand.matchedBrand && (
                          <div style={{ fontSize: 14, color: '#64748b' }}>
                            Will match to: <strong>{brand.matchedBrand.brand_name}</strong>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {brand.matchType !== 'exact' && (
                          <>
                            <button
                              onClick={() => updateMatch(brand.rowIndex, brand.matchedBrand ? true : false, brand.matchedBrand?.brand_id, brand.matchedBrand?.brand_name)}
                              style={{
                                padding: '6px 12px',
                                background: brandMatches[brand.rowIndex]?.useExisting ? '#10b981' : '#e2e8f0',
                                color: brandMatches[brand.rowIndex]?.useExisting ? 'white' : '#475569',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 13,
                                cursor: 'pointer'
                              }}
                            >
                              Match
                            </button>
                            <button
                              onClick={() => updateMatch(brand.rowIndex, false)}
                              style={{
                                padding: '6px 12px',
                                background: !brandMatches[brand.rowIndex]?.useExisting ? '#3b82f6' : '#e2e8f0',
                                color: !brandMatches[brand.rowIndex]?.useExisting ? 'white' : '#475569',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 13,
                                cursor: 'pointer'
                              }}
                            >
                              Create New
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Orphaned Brands */}
              {supplier.orphanedBrands && supplier.orphanedBrands.length > 0 && (
                <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                  <div style={{ padding: '12px 16px', background: '#fef3c7', borderBottom: '1px solid #fbbf24' }}>
                    <strong style={{ color: '#92400e' }}>⚠️ Brands Will Be Orphaned ({supplier.orphanedBrands.length})</strong>
                    <div style={{ fontSize: 13, color: '#92400e', marginTop: 4 }}>
                      These brands exist in the database but are not in your import. They will be moved to orphans table.
                    </div>
                  </div>
                  {supplier.orphanedBrands.map((brand, brandIdx) => (
                    <div key={brandIdx} style={{ 
                      padding: '12px 16px', 
                      borderBottom: '1px solid #fef3c7',
                      background: '#fffbeb'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <strong>{brand.brand_name}</strong>
                        <span style={{ padding: '2px 8px', background: '#fed7aa', color: '#9a3412', borderRadius: 4, fontSize: 12 }}>
                          🗑️ Will Orphan
                        </span>
                        <span style={{ fontSize: 13, color: '#92400e' }}>States: {brand.states}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={handleImport}
            disabled={loading}
            style={{
              marginTop: 24,
              padding: '12px 24px',
              background: loading ? '#94a3b8' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              fontSize: 16
            }}
          >
            {loading ? 'Importing...' : 'Confirm & Import to Database'}
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
            {results.relationshipsOrphaned > 0 && (
              <p style={{ color: '#d97706' }}>🗑️ Relationships moved to orphans: {results.relationshipsOrphaned}</p>
            )}
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
