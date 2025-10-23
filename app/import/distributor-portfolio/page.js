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
      
      // Initialize distributor matches (one per distributor)
      result.distributorReviews?.forEach(distributorReview => {
        const distributorKey = `${distributorReview.distributorName}|DISTRIBUTOR`;
        matches[distributorKey] = {
          useExistingDistributor: distributorReview.distributorMatchType !== 'new',
          existingDistributorId: distributorReview.distributorMatched?.distributor_id,
          existingDistributorName: distributorReview.distributorMatched?.distributor_name,
          importDistributorName: distributorReview.distributorName
        };
        
        // Initialize supplier matches for each supplier under this distributor
        distributorReview.importSuppliers?.forEach(supplier => {
          const supplierKey = `${distributorReview.distributorName}|${supplier.supplierName}|${supplier.rowIndex}`;
          matches[supplierKey] = {
            useExistingSupplier: supplier.matchType !== 'new',
            existingSupplierId: supplier.matchedSupplier?.supplier_id,
            existingSupplierName: supplier.matchedSupplier?.supplier_name,
            importSupplierName: supplier.supplierName
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
          
          // Look for distributor match
          const distributorKey = `${row.distributor_name}|DISTRIBUTOR`;
          const distributorMatch = relationshipMatches[distributorKey];
          
          // Look for supplier match
          const supplierKey = `${row.distributor_name}|${row.supplier_name}|${originalIndex}`;
          const supplierMatch = relationshipMatches[supplierKey];
          
          // Combine distributor and supplier matches for this row
          if (distributorMatch || supplierMatch) {
            batchMatches[idx] = {
              useExistingDistributor: distributorMatch?.useExistingDistributor || false,
              existingDistributorId: distributorMatch?.existingDistributorId,
              existingDistributorName: distributorMatch?.existingDistributorName,
              useExistingSupplier: supplierMatch?.useExistingSupplier || false,
              existingSupplierId: supplierMatch?.existingSupplierId,
              existingSupplierName: supplierMatch?.existingSupplierName,
              importDistributorName: row.distributor_name,
              importSupplierName: row.supplier_name
            };
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

      {validation && validation.distributorReviews && (
        <div style={{ marginTop: 32 }}>
          <h2>Review Import Changes</h2>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            Review all distributors and their suppliers below. You can manually adjust matches before importing.
          </p>

          {validation.distributorReviews.map((distributor, idx) => {
            // Group suppliers by match types
            const exactMatches = distributor.importSuppliers.filter(s => s.matchType === 'exact');
            const fuzzyMatches = distributor.importSuppliers.filter(s => s.matchType === 'fuzzy');
            const newSuppliers = distributor.importSuppliers.filter(s => s.matchType === 'new');

            return (
              <div key={idx} style={{ marginBottom: 40 }}>
                <h3 style={{ 
                  padding: '12px 16px', 
                  background: '#1e293b', 
                  color: 'white',
                  borderRadius: '8px 8px 0 0',
                  margin: 0
                }}>
                  {distributor.distributorName}
                </h3>

                {/* Column Headers */}
                <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', background: '#f8fafc' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    <div style={{ padding: '12px 16px', borderRight: '2px solid #cbd5e1' }}>
                      <strong>Import Suppliers</strong>
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                      <strong>Existing Portfolio</strong>
                    </div>
                  </div>
                </div>

                {/* Distributor Match Section */}
                <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', background: '#f8fafc' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <strong style={{ minWidth: 120 }}>Distributor Match:</strong>
                      <select
                        value={relationshipMatches[`${distributor.distributorName}|DISTRIBUTOR`]?.useExistingDistributor ? 
                          relationshipMatches[`${distributor.distributorName}|DISTRIBUTOR`]?.existingDistributorId : 'CREATE_NEW'}
                        onChange={(e) => {
                          const key = `${distributor.distributorName}|DISTRIBUTOR`;
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
                        <option value="CREATE_NEW">🆕 Create New: "{distributor.distributorName}"</option>
                        <option disabled style={{ color: '#94a3b8' }}>─── Match to Existing ───</option>
                        {validation.allExistingDistributors?.map(d => (
                          <option key={d.distributor_id} value={d.distributor_id}>
                            {d.distributor_name}
                          </option>
                        ))}
                      </select>
                      {relationshipMatches[`${distributor.distributorName}|DISTRIBUTOR`]?.useExistingDistributor && relationshipMatches[`${distributor.distributorName}|DISTRIBUTOR`]?.existingDistributorName && (
                        <div style={{ fontSize: 13, color: '#059669', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          ✓ {relationshipMatches[`${distributor.distributorName}|DISTRIBUTOR`].existingDistributorName}
                        </div>
                      )}
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
                    {exactMatches.map((supplier, supplierIdx) => (
                      <TwoColumnSupplierRow 
                        key={supplierIdx} 
                        supplier={supplier} 
                        distributorName={distributor.distributorName}
                        relationshipMatches={relationshipMatches}
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
                    {fuzzyMatches.map((supplier, supplierIdx) => (
                      <TwoColumnSupplierRow 
                        key={supplierIdx} 
                        supplier={supplier} 
                        distributorName={distributor.distributorName}
                        relationshipMatches={relationshipMatches}
                        validation={validation}
                        handleManualMatch={handleManualMatch}
                        updateMatch={updateMatch}
                      />
                    ))}
                  </div>
                )}

                {/* New Suppliers - Add */}
                {newSuppliers.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                    <div style={{ padding: '12px 16px', background: '#dbeafe', borderBottom: '1px solid #3b82f6' }}>
                      <strong style={{ color: '#1e40af' }}>+ New Supplier - Add ({newSuppliers.length})</strong>
                      <span style={{ fontSize: 13, color: '#1e40af', marginLeft: 8 }}>
                        - Will create these suppliers
                      </span>
                    </div>
                    {newSuppliers.map((supplier, supplierIdx) => (
                      <TwoColumnSupplierRow 
                        key={supplierIdx} 
                        supplier={supplier} 
                        distributorName={distributor.distributorName}
                        relationshipMatches={relationshipMatches}
                        validation={validation}
                        handleManualMatch={handleManualMatch}
                        updateMatch={updateMatch}
                      />
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

function TwoColumnSupplierRow({ supplier, distributorName, relationshipMatches, validation, handleManualMatch, updateMatch }) {
  const isFuzzy = supplier.matchType === 'fuzzy';
  
  return (
    <div style={{ 
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 0,
      borderBottom: '1px solid #f1f5f9'
    }}>
      {/* Left Column - Import Supplier */}
      <div style={{ padding: '12px 16px', borderRight: '2px solid #cbd5e1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 15 }}>{supplier.supplierName}</strong>
        </div>
        {isFuzzy && supplier.similarity && (
          <div style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>
            {Math.round(supplier.similarity * 100)}% similar to suggested match
          </div>
        )}
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          <strong>States:</strong> {supplier.states.map(s => s.state.state_name).join(', ')}
        </div>
      </div>

      {/* Right Column - Existing/Match */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <select
          value={relationshipMatches[`${distributorName}|${supplier.supplierName}|${supplier.rowIndex}`]?.useExistingSupplier ? 
            relationshipMatches[`${distributorName}|${supplier.supplierName}|${supplier.rowIndex}`]?.existingSupplierId : 'CREATE_NEW'}
          onChange={(e) => {
            const key = `${distributorName}|${supplier.supplierName}|${supplier.rowIndex}`;
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
          <option value="CREATE_NEW">🆕 Create New: "{supplier.supplierName}"</option>
          <option disabled style={{ color: '#94a3b8' }}>─── Match to Existing ───</option>
          {validation.allExistingSuppliers?.map(es => (
            <option key={es.supplier_id} value={es.supplier_id}>
              {es.supplier_name}
            </option>
          ))}
        </select>
        {relationshipMatches[`${distributorName}|${supplier.supplierName}|${supplier.rowIndex}`]?.useExistingSupplier && relationshipMatches[`${distributorName}|${supplier.supplierName}|${supplier.rowIndex}`]?.existingSupplierName && (
          <div style={{ fontSize: 13, color: '#059669', fontWeight: 500, whiteSpace: 'nowrap' }}>
            ✓ {relationshipMatches[`${distributorName}|${supplier.supplierName}|${supplier.rowIndex}`].existingSupplierName}
          </div>
        )}
      </div>
    </div>
  );
}