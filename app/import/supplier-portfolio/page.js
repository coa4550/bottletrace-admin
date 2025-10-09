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
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setValidation(null);
    setResults(null);
    setBrandMatches({});
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
      console.log('Validating with rows:', parsed);
      const response = await fetch('/api/import/supplier-portfolio/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed })
      });
      
      const result = await response.json();
      console.log('Validation result:', result);
      
      if (result.error) {
        alert('Validation error: ' + result.error);
        setLoading(false);
        return;
      }
      
      setValidation(result);
      
      // Initialize brand matches with defaults
      const matches = {};
      result.supplierReviews?.forEach(sr => {
        sr.importBrands?.forEach(brand => {
          matches[brand.rowIndex] = {
            useExisting: brand.matchType !== 'new',
            existingBrandId: brand.matchedBrand?.brand_id,
            existingBrandName: brand.matchedBrand?.brand_name,
            importBrandName: brand.brandName
          };
        });
      });
      console.log('Brand matches initialized:', matches);
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
    setProgress({ current: 0, total: parsed.length, message: 'Starting import...' });
    
    try {
      // Process in batches for progress updates
      const BATCH_SIZE = 10;
      const batches = [];
      for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
        batches.push(parsed.slice(i, i + BATCH_SIZE));
      }

      let totalSuppliersCreated = 0;
      let totalBrandsCreated = 0;
      let totalRelationshipsCreated = 0;
      let totalRelationshipsVerified = 0;
      let totalRelationshipsOrphaned = 0;
      let totalSkipped = 0;
      let allErrors = [];
      let importLogId = null;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchStartIndex = i * BATCH_SIZE;
        
        setProgress({
          current: batchStartIndex,
          total: parsed.length,
          message: `Processing rows ${batchStartIndex + 1}-${Math.min(batchStartIndex + batch.length, parsed.length)} of ${parsed.length}...`
        });

        // Extract confirmed matches for this batch only
        const batchMatches = {};
        batch.forEach((_, idx) => {
          const originalIndex = batchStartIndex + idx;
          if (brandMatches[originalIndex]) {
            batchMatches[idx] = brandMatches[originalIndex];
          }
        });

        const response = await fetch('/api/import/supplier-portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            rows: batch,
            confirmedMatches: batchMatches,
            fileName: file?.name,
            isFirstBatch: i === 0,
            isLastBatch: i === batches.length - 1,
            existingImportLogId: importLogId
          })
        });
        
        const result = await response.json();
        
        // Save importLogId from first batch
        if (i === 0 && result.importLogId) {
          importLogId = result.importLogId;
        }

        // Accumulate results
        totalSuppliersCreated += result.suppliersCreated || 0;
        totalBrandsCreated += result.brandsCreated || 0;
        totalRelationshipsCreated += result.relationshipsCreated || 0;
        totalRelationshipsVerified += result.relationshipsVerified || 0;
        totalRelationshipsOrphaned += result.relationshipsOrphaned || 0;
        totalSkipped += result.skipped || 0;
        if (result.errors && result.errors.length > 0) {
          allErrors = [...allErrors, ...result.errors];
        }
      }

      setProgress({
        current: parsed.length,
        total: parsed.length,
        message: 'Import complete!'
      });

      setResults({
        suppliersCreated: totalSuppliersCreated,
        brandsCreated: totalBrandsCreated,
        relationshipsCreated: totalRelationshipsCreated,
        relationshipsVerified: totalRelationshipsVerified,
        relationshipsOrphaned: totalRelationshipsOrphaned,
        skipped: totalSkipped,
        errors: allErrors.slice(0, 20), // Show up to 20 errors
        importLogId
      });
      
      setValidation(null);
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed: ' + error.message);
    } finally {
      setLoading(false);
      setTimeout(() => setProgress({ current: 0, total: 0, message: '' }), 2000);
    }
  };

  const updateMatch = (rowIndex, useExisting, brandId = null, brandName = null) => {
    setBrandMatches(prev => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        useExisting,
        existingBrandId: brandId,
        existingBrandName: brandName
      }
    }));
  };

  const handleManualMatch = (rowIndex, selectedBrandId) => {
    const selectedBrand = validation.allExistingBrands?.find(b => b.brand_id === selectedBrandId);
    if (selectedBrand) {
      setBrandMatches(prev => ({
        ...prev,
        [rowIndex]: {
          ...prev[rowIndex],
          useExisting: true,
          existingBrandId: selectedBrand.brand_id,
          existingBrandName: selectedBrand.brand_name
        }
      }));
    }
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

      {parsed.length > 0 && <p style={{ marginTop: 16, fontSize: 14, color: '#64748b' }}>Parsed {parsed.length} rows</p>}

      <button
        onClick={handleValidate}
        disabled={loading || parsed.length === 0}
        style={{
          marginTop: 16,
          padding: '10px 20px',
          background: (loading || parsed.length === 0) ? '#94a3b8' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: (loading || parsed.length === 0) ? 'not-allowed' : 'pointer',
          fontWeight: 500
        }}
      >
        {loading ? 'Validating...' : 'Validate & Review Changes'}
      </button>

      {validation && validation.supplierReviews && (
        <div style={{ marginTop: 32 }}>
          <h2>Review Import Changes</h2>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            Review all brands below. You can manually adjust matches before importing.
          </p>

          {validation.supplierReviews.map((supplier, idx) => {
            // Group brands by type
            const exactMatches = supplier.importBrands.filter(b => b.matchType === 'exact');
            const fuzzyMatches = supplier.importBrands.filter(b => b.matchType === 'fuzzy');
            const newBrands = supplier.importBrands.filter(b => b.matchType === 'new');
            const orphanedBrands = supplier.orphanedBrands || [];

            return (
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

                {/* Column Headers */}
                <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', background: '#f8fafc' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    <div style={{ padding: '12px 16px', borderRight: '2px solid #cbd5e1' }}>
                      <strong>Import Brands</strong>
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                      <strong>Existing Portfolio</strong>
                    </div>
                  </div>
                </div>

                {/* Exact Matches - Ignore */}
                {exactMatches.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                    <div style={{ padding: '12px 16px', background: '#d1fae5', borderBottom: '1px solid #10b981' }}>
                      <strong style={{ color: '#065f46' }}>✓ Exact Match - Ignore ({exactMatches.length})</strong>
                      <span style={{ fontSize: 13, color: '#065f46', marginLeft: 8 }}>
                        - Will re-verify these relationships
                      </span>
                    </div>
                    {exactMatches.map((brand, brandIdx) => (
                      <TwoColumnBrandRow 
                        key={brandIdx} 
                        brand={brand} 
                        brandMatches={brandMatches}
                        validation={validation}
                        handleManualMatch={handleManualMatch}
                        updateMatch={updateMatch}
                      />
                    ))}
                  </div>
                )}

                {/* Fuzzy Matches - Confirm */}
                {fuzzyMatches.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                    <div style={{ padding: '12px 16px', background: '#fef3c7', borderBottom: '1px solid #fbbf24' }}>
                      <strong style={{ color: '#92400e' }}>~ Fuzzy Match - Confirm ({fuzzyMatches.length})</strong>
                      <span style={{ fontSize: 13, color: '#92400e', marginLeft: 8 }}>
                        - Review and confirm matches
                      </span>
                    </div>
                    {fuzzyMatches.map((brand, brandIdx) => (
                      <TwoColumnBrandRow 
                        key={brandIdx} 
                        brand={brand} 
                        brandMatches={brandMatches}
                        validation={validation}
                        handleManualMatch={handleManualMatch}
                        updateMatch={updateMatch}
                      />
                    ))}
                  </div>
                )}

                {/* New Brands - Add */}
                {newBrands.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                    <div style={{ padding: '12px 16px', background: '#dbeafe', borderBottom: '1px solid #3b82f6' }}>
                      <strong style={{ color: '#1e40af' }}>+ New Brand - Add ({newBrands.length})</strong>
                      <span style={{ fontSize: 13, color: '#1e40af', marginLeft: 8 }}>
                        - Will create these brands
                      </span>
                    </div>
                    {newBrands.map((brand, brandIdx) => (
                      <TwoColumnBrandRow 
                        key={brandIdx} 
                        brand={brand} 
                        brandMatches={brandMatches}
                        validation={validation}
                        handleManualMatch={handleManualMatch}
                        updateMatch={updateMatch}
                      />
                    ))}
                  </div>
                )}

                {/* Orphaned Brands - Move */}
                {orphanedBrands.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                    <div style={{ padding: '12px 16px', background: '#fee2e2', borderBottom: '1px solid #ef4444' }}>
                      <strong style={{ color: '#991b1b' }}>🗑️ Orphan - Move ({orphanedBrands.length})</strong>
                      <span style={{ fontSize: 13, color: '#991b1b', marginLeft: 8 }}>
                        - Will move to orphans table
                      </span>
                    </div>
                    {orphanedBrands.map((brand, brandIdx) => (
                      <div key={brandIdx} style={{ 
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 0,
                        borderBottom: '1px solid #fecaca',
                        background: '#fef2f2'
                      }}>
                        <div style={{ padding: '12px 16px', borderRight: '2px solid #fecaca' }}>
                          <span style={{ color: '#94a3b8', fontSize: 14 }}>— Not in import —</span>
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                          <strong>{brand.brand_name}</strong>
                          <span style={{ fontSize: 13, color: '#991b1b', marginLeft: 8 }}>
                            States: {brand.states}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

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

          {/* Progress Bar */}
          {loading && progress.total > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ marginBottom: 8, fontSize: 14, color: '#64748b' }}>
                {progress.message}
              </div>
              <div style={{ 
                width: '100%', 
                height: 24, 
                background: '#e2e8f0', 
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{ 
                  width: `${(progress.current / progress.total) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #10b981, #059669)',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ 
                    color: 'white', 
                    fontSize: 12, 
                    fontWeight: 600,
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)'
                  }}>
                    {Math.round((progress.current / progress.total) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}
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
            {results.importLogId && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #86efac' }}>
                <a 
                  href={`/import/logs/${results.importLogId}`}
                  style={{ color: '#059669', textDecoration: 'underline', fontSize: 14 }}
                >
                  📋 View detailed import log
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TwoColumnBrandRow({ brand, brandMatches, validation, handleManualMatch, updateMatch }) {
  const isFuzzy = brand.matchType === 'fuzzy';
  
  return (
    <div style={{ 
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 0,
      borderBottom: '1px solid #f1f5f9'
    }}>
      {/* Left Column - Import Brand */}
      <div style={{ padding: '12px 16px', borderRight: '2px solid #cbd5e1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 15 }}>{brand.brandName}</strong>
          <span style={{ fontSize: 13, color: '#64748b' }}>State: {brand.stateCode}</span>
        </div>
        {isFuzzy && brand.similarity && (
          <div style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>
            {Math.round(brand.similarity * 100)}% similar to suggested match
          </div>
        )}
      </div>

      {/* Right Column - Existing/Match */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <select
          value={brandMatches[brand.rowIndex]?.useExisting ? brandMatches[brand.rowIndex]?.existingBrandId : 'CREATE_NEW'}
          onChange={(e) => {
            if (e.target.value === 'CREATE_NEW') {
              updateMatch(brand.rowIndex, false);
            } else if (e.target.value) {
              handleManualMatch(brand.rowIndex, e.target.value);
            }
          }}
          style={{
            padding: '6px 10px',
            border: '1px solid #cbd5e1',
            borderRadius: 4,
            fontSize: 14,
            minWidth: 250,
            maxWidth: 300,
            background: 'white'
          }}
        >
          <option value="CREATE_NEW">🆕 Create New: "{brand.brandName}"</option>
          <option disabled style={{ color: '#94a3b8' }}>─── Match to Existing ───</option>
          {validation.allExistingBrands?.map(eb => (
            <option key={eb.brand_id} value={eb.brand_id}>
              {eb.brand_name}
            </option>
          ))}
        </select>
        {brandMatches[brand.rowIndex]?.useExisting && brandMatches[brand.rowIndex]?.existingBrandName && (
          <div style={{ fontSize: 13, color: '#059669', fontWeight: 500, whiteSpace: 'nowrap' }}>
            ✓ {brandMatches[brand.rowIndex].existingBrandName}
          </div>
        )}
      </div>
    </div>
  );
}
