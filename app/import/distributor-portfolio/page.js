'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function ImportDistributorPortfolio() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [validation, setValidation] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [relationshipMatches, setRelationshipMatches] = useState({});
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [verifyRelationships, setVerifyRelationships] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setValidation(null);
    setResults(null);
    setRelationshipMatches({});
    parseFile(selectedFile);
  };

  const parseFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { 
        type: 'array',
        codepage: 65001, // UTF-8 encoding
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(firstSheet, {
        raw: false,
        defval: ''
      });
      setParsed(json);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleValidate = async () => {
    setLoading(true);
    try {
      console.log('Validating with rows:', parsed);
      const response = await fetch('/api/import/distributor-portfolio/validate', {
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
      
      // Initialize relationship matches with defaults
      const matches = {};
      result.relationshipReviews?.forEach(review => {
        review.rows.forEach(row => {
          const key = `${review.distributorName}|${review.supplierName}|${row.originalIndex}`;
          matches[key] = {
            useExistingDistributor: review.distributorMatchType !== 'new',
            existingDistributorId: review.distributorMatched?.distributor_id,
            existingDistributorName: review.distributorMatched?.distributor_name,
            useExistingSupplier: review.supplierMatchType !== 'new',
            existingSupplierId: review.supplierMatched?.supplier_id,
            existingSupplierName: review.supplierMatched?.supplier_name,
            importDistributorName: review.distributorName,
            importSupplierName: review.supplierName
          };
        });
      });
      console.log('Relationship matches initialized:', matches);
      setRelationshipMatches(matches);
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

      let totalDistributorsCreated = 0;
      let totalSuppliersCreated = 0;
      let totalRelationshipsCreated = 0;
      let totalRelationshipsVerified = 0;
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
          const row = batch[idx];
          const key = `${row.distributor_name}|${row.supplier_name}|${originalIndex}`;
          if (relationshipMatches[key]) {
            batchMatches[idx] = relationshipMatches[key];
          }
        });

        const response = await fetch('/api/import/distributor-portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            rows: batch,
            confirmedMatches: batchMatches,
            fileName: file?.name,
            isFirstBatch: i === 0,
            isLastBatch: i === batches.length - 1,
            existingImportLogId: importLogId,
            verifyRelationships: verifyRelationships
          })
        });
        
        const result = await response.json();
        
        // Save importLogId from first batch
        if (i === 0 && result.importLogId) {
          importLogId = result.importLogId;
        }

        // Accumulate results
        totalDistributorsCreated += result.distributorsCreated || 0;
        totalSuppliersCreated += result.suppliersCreated || 0;
        totalRelationshipsCreated += result.relationshipsCreated || 0;
        totalRelationshipsVerified += result.relationshipsVerified || 0;
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
        distributorsCreated: totalDistributorsCreated,
        suppliersCreated: totalSuppliersCreated,
        relationshipsCreated: totalRelationshipsCreated,
        relationshipsVerified: totalRelationshipsVerified,
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

  const updateMatch = (key, field, value) => {
    setRelationshipMatches(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const handleManualMatch = (key, type, selectedId) => {
    if (type === 'distributor') {
      const selectedDistributor = validation.allExistingDistributors?.find(d => d.distributor_id === selectedId);
      if (selectedDistributor) {
        setRelationshipMatches(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            useExistingDistributor: true,
            existingDistributorId: selectedDistributor.distributor_id,
            existingDistributorName: selectedDistributor.distributor_name
          }
        }));
      }
    } else if (type === 'supplier') {
      const selectedSupplier = validation.allExistingSuppliers?.find(s => s.supplier_id === selectedId);
      if (selectedSupplier) {
        setRelationshipMatches(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            useExistingSupplier: true,
            existingSupplierId: selectedSupplier.supplier_id,
            existingSupplierName: selectedSupplier.supplier_name
          }
        }));
      }
    }
  };

  const getStatusBadge = (matchType, similarity) => {
    if (matchType === 'exact') {
      return <span style={{ padding: '2px 8px', background: '#d1fae5', color: '#065f46', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>✓ Exact Match</span>;
    } else if (matchType === 'fuzzy') {
      return <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>~ Fuzzy ({Math.round(similarity * 100)}%)</span>;
    } else {
      return <span style={{ padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>+ New</span>;
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Import Distributor Portfolio</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>
        Upload a spreadsheet with distributor portfolios. Expected columns: distributor_name, supplier_name, state_name or state_code
      </p>
      <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
        💡 <strong>Note:</strong> Each distributor-supplier relationship can be specific to one or more states. Use "ALL" for nationwide relationships.
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

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleValidate}
          disabled={loading || parsed.length === 0}
          style={{
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
        
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
          <input
            type="checkbox"
            checked={verifyRelationships}
            onChange={(e) => setVerifyRelationships(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>Mark distributor-supplier relationships as verified</span>
        </label>
      </div>

      {validation && validation.relationshipReviews && (
        <div style={{ marginTop: 32 }}>
          <h2>Review Import Changes</h2>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            Review all relationships below. You can manually adjust matches before importing.
          </p>

          {validation.relationshipReviews.map((relationship, idx) => {
            // Group by match types
            const distributorExact = relationship.distributorMatchType === 'exact';
            const distributorFuzzy = relationship.distributorMatchType === 'fuzzy';
            const distributorNew = relationship.distributorMatchType === 'new';
            
            const supplierExact = relationship.supplierMatchType === 'exact';
            const supplierFuzzy = relationship.supplierMatchType === 'fuzzy';
            const supplierNew = relationship.supplierMatchType === 'new';

            return (
              <div key={idx} style={{ marginBottom: 40 }}>
                <h3 style={{ 
                  padding: '12px 16px', 
                  background: '#1e293b', 
                  color: 'white',
                  borderRadius: '8px 8px 0 0',
                  margin: 0
                }}>
                  {relationship.distributorName} → {relationship.supplierName}
                </h3>

                {/* Column Headers */}
                <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', background: '#f8fafc' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    <div style={{ padding: '12px 16px', borderRight: '2px solid #cbd5e1' }}>
                      <strong>Import Relationship</strong>
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                      <strong>Existing Relationship</strong>
                    </div>
                  </div>
                </div>

                {/* Relationship Details */}
                <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    {/* Left Column - Import Relationship */}
                    <div style={{ padding: '12px 16px', borderRight: '2px solid #cbd5e1' }}>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Distributor:</strong> {relationship.distributorName}
                        {distributorExact && <span style={{ marginLeft: 8 }}>✓</span>}
                        {distributorFuzzy && <span style={{ marginLeft: 8 }}>~</span>}
                        {distributorNew && <span style={{ marginLeft: 8 }}>+</span>}
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Supplier:</strong> {relationship.supplierName}
                        {supplierExact && <span style={{ marginLeft: 8 }}>✓</span>}
                        {supplierFuzzy && <span style={{ marginLeft: 8 }}>~</span>}
                        {supplierNew && <span style={{ marginLeft: 8 }}>+</span>}
                      </div>
                      <div>
                        <strong>States:</strong> {relationship.states.map(s => s.state.state_name).join(', ')}
                      </div>
                    </div>

                    {/* Right Column - Existing Relationship */}
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ marginBottom: 12 }}>
                        <strong>Distributor Match:</strong>
                        <div style={{ marginTop: 4 }}>
                          <select
                            value={relationshipMatches[`${relationship.distributorName}|${relationship.supplierName}|${relationship.rows[0].originalIndex}`]?.useExistingDistributor ? 
                              relationshipMatches[`${relationship.distributorName}|${relationship.supplierName}|${relationship.rows[0].originalIndex}`]?.existingDistributorId : 'CREATE_NEW'}
                            onChange={(e) => {
                              const key = `${relationship.distributorName}|${relationship.supplierName}|${relationship.rows[0].originalIndex}`;
                              if (e.target.value === 'CREATE_NEW') {
                                updateMatch(key, 'useExistingDistributor', false);
                              } else if (e.target.value) {
                                handleManualMatch(key, 'distributor', e.target.value);
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
                            <option value="CREATE_NEW">🆕 Create New: "{relationship.distributorName}"</option>
                            <option disabled style={{ color: '#94a3b8' }}>─── Match to Existing ───</option>
                            {validation.allExistingDistributors?.map(d => (
                              <option key={d.distributor_id} value={d.distributor_id}>
                                {d.distributor_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <strong>Supplier Match:</strong>
                        <div style={{ marginTop: 4 }}>
                          <select
                            value={relationshipMatches[`${relationship.distributorName}|${relationship.supplierName}|${relationship.rows[0].originalIndex}`]?.useExistingSupplier ? 
                              relationshipMatches[`${relationship.distributorName}|${relationship.supplierName}|${relationship.rows[0].originalIndex}`]?.existingSupplierId : 'CREATE_NEW'}
                            onChange={(e) => {
                              const key = `${relationship.distributorName}|${relationship.supplierName}|${relationship.rows[0].originalIndex}`;
                              if (e.target.value === 'CREATE_NEW') {
                                updateMatch(key, 'useExistingSupplier', false);
                              } else if (e.target.value) {
                                handleManualMatch(key, 'supplier', e.target.value);
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
                            <option value="CREATE_NEW">🆕 Create New: "{relationship.supplierName}"</option>
                            <option disabled style={{ color: '#94a3b8' }}>─── Match to Existing ───</option>
                            {validation.allExistingSuppliers?.map(s => (
                              <option key={s.supplier_id} value={s.supplier_id}>
                                {s.supplier_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
            <p>✅ Distributors created: {results.distributorsCreated}</p>
            <p>✅ Suppliers created: {results.suppliersCreated}</p>
            <p>✅ Relationships created: {results.relationshipsCreated}</p>
            {verifyRelationships ? (
              <p>🔄 Relationships verified: {results.relationshipsVerified}</p>
            ) : (
              <p>📝 Relationships updated (not verified): {results.relationshipsVerified}</p>
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