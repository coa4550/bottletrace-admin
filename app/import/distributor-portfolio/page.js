'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function ImportDistributorSupplierPortfolio() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [validation, setValidation] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [manualMatches, setManualMatches] = useState({});
  const [verifyRelationships, setVerifyRelationships] = useState(false);

  const handleMatch = (itemName, existingItem, type) => {
    console.log('Matching:', itemName, 'to', existingItem, 'type:', type);
    setManualMatches(prev => ({
      ...prev,
      [`${type}_${itemName}`]: existingItem
    }));
  };


  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setValidation(null);
    setResults(null);
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
      const response = await fetch('/api/import/distributor-portfolio/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed })
      });
      
      const result = await response.json();
      
      if (result.error) {
        alert('Validation error: ' + result.error);
        setLoading(false);
        return;
      }
      
      setValidation(result);
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
      const BATCH_SIZE = 50;
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

        const response = await fetch('/api/import/distributor-portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            rows: batch,
            manualMatches,
            fileName: file?.name,
            isFirstBatch: i === 0,
            isLastBatch: i === batches.length - 1,
            existingImportLogId: importLogId,
            verifyRelationships
          })
        });
        
        const result = await response.json();
        
        if (i === 0 && result.importLogId) {
          importLogId = result.importLogId;
        }

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
        errors: allErrors.slice(0, 20),
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

  return (
    <div style={{ padding: 20 }}>
      <h1>Import Distributor Portfolio</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>
        Upload a spreadsheet with distributor-supplier relationships by state. Expected columns: distributor_name, supplier_name, state_code (or state_name)
      </p>
      <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
        💡 <strong>Tips:</strong> 
        <br/>• Use <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>ALL</code> for nationwide distribution
        <br/>• Use comma-separated values like <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>CA, NY, TX</code> for multiple states
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

      {validation && (
        <div style={{ marginTop: 32 }}>
          <h2>Review Import Changes</h2>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            Review all distributor-supplier relationships below. You can manually adjust matches before importing.
          </p>

          {validation.relationshipDetails?.map((rel, idx) => {
            // Group relationships by type
            const exactMatches = [];
            const fuzzyMatches = [];
            const newRelationships = [];
            
            // Determine relationship type based on existence
            if (rel.distributorExists && rel.supplierExists) {
              exactMatches.push(rel);
            } else if (rel.distributorExists || rel.supplierExists) {
              fuzzyMatches.push(rel);
            } else {
              newRelationships.push(rel);
            }

            return (
              <div key={idx} style={{ marginBottom: 40 }}>
                <h3 style={{ 
                  padding: '12px 16px', 
                  background: '#1e293b', 
                  color: 'white',
                  borderRadius: '8px 8px 0 0',
                  margin: 0
                }}>
                  {rel.distributorName} ↔ {rel.supplierName}
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

                {/* Exact Matches - Ignore */}
                {exactMatches.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                    <div style={{ padding: '12px 16px', background: '#d1fae5', borderBottom: '1px solid #10b981' }}>
                      <strong style={{ color: '#065f46' }}>✓ Exact Match - Ignore ({exactMatches.length})</strong>
                      <span style={{ fontSize: 13, color: '#065f46', marginLeft: 8 }}>
                        - Will re-verify these relationships
                      </span>
                    </div>
                    {exactMatches.map((rel, relIdx) => (
                      <TwoColumnRelationshipRow 
                        key={relIdx} 
                        relationship={rel} 
                        type="exact"
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
                    {fuzzyMatches.map((rel, relIdx) => (
                      <TwoColumnRelationshipRow 
                        key={relIdx} 
                        relationship={rel} 
                        type="fuzzy"
                        allSuppliers={validation.allExistingSuppliers}
                      />
                    ))}
                  </div>
                )}

                {/* New Relationships - Add */}
                {newRelationships.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                    <div style={{ padding: '12px 16px', background: '#dbeafe', borderBottom: '1px solid #3b82f6' }}>
                      <strong style={{ color: '#1e40af' }}>+ New Relationship - Add ({newRelationships.length})</strong>
                      <span style={{ fontSize: 13, color: '#1e40af', marginLeft: 8 }}>
                        - Will create these relationships
                      </span>
                    </div>
                    {newRelationships.map((rel, relIdx) => (
                      <TwoColumnRelationshipRow 
                        key={relIdx} 
                        relationship={rel} 
                        type="new"
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
                  transition: 'width 0.3s ease'
                }}>
                  <span style={{ 
                    color: 'white', 
                    fontSize: 12, 
                    fontWeight: 600,
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    lineHeight: '24px'
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


function TwoColumnRelationshipRow({ relationship, type, allSuppliers = [] }) {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: 0,
      borderBottom: '1px solid #e2e8f0'
    }}>
      {/* Left Column - Import Relationship */}
      <div style={{ 
        padding: '12px 16px', 
        borderRight: '1px solid #e2e8f0',
        background: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ 
            width: 32, 
            height: 32, 
            background: '#e2e8f0', 
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: '#94a3b8'
          }}>
            📦
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{relationship.distributorName}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {relationship.distributorExists ? '✓ Existing' : '+ New'}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginLeft: 40 }}>
          ↔ {relationship.supplierName}
        </div>
      </div>

      {/* Right Column - Existing Relationship */}
      <div style={{ 
        padding: '12px 16px',
        background: '#f8fafc'
      }}>
        {type === 'exact' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              background: '#d1fae5', 
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#065f46'
            }}>
              ✓
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#065f46' }}>
                {relationship.distributorName} ↔ {relationship.supplierName}
              </div>
              <div style={{ fontSize: 12, color: '#065f46' }}>
                ✓ Existing Relationship
              </div>
            </div>
          </div>
        ) : type === 'fuzzy' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              background: '#fef3c7', 
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#92400e'
            }}>
              ~
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#92400e', marginBottom: 4 }}>
                Suggested Supplier
              </div>
              <select
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  fontSize: 13,
                  background: 'white'
                }}
                defaultValue={relationship.supplierName}
              >
                <option value={relationship.supplierName}>{relationship.supplierName}</option>
                {allSuppliers?.map(supplier => (
                  <option key={supplier.supplier_id} value={supplier.supplier_name}>
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
                Review and confirm
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              background: '#dbeafe', 
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#1e40af'
            }}>
              +
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1e40af' }}>
                New Relationship
              </div>
              <div style={{ fontSize: 12, color: '#1e40af' }}>
                Will be created
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


