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
  const [selectedSummaryItem, setSelectedSummaryItem] = useState(null);
  const [manualMatches, setManualMatches] = useState({});

  const handleMatch = (itemName, existingItem, type) => {
    setManualMatches(prev => ({
      ...prev,
      [`${type}_${itemName}`]: existingItem
    }));
  };

  const getModalData = () => {
    if (selectedSummaryItem === 'newDistributors') {
      return {
        type: 'distributor',
        items: validation.newDistributorsList,
        existingItems: validation.allExistingDistributors
      };
    } else if (selectedSummaryItem === 'newSuppliers') {
      return {
        type: 'supplier',
        items: validation.newSuppliersList,
        existingItems: validation.allExistingSuppliers
      };
    }
    return null;
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
      const response = await fetch('/api/import/distributor-supplier-portfolio/validate', {
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

        const response = await fetch('/api/import/distributor-supplier-portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            rows: batch,
            manualMatches,
            fileName: file?.name,
            isFirstBatch: i === 0,
            isLastBatch: i === batches.length - 1,
            existingImportLogId: importLogId
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
      <h1>Import Distributor-Supplier Portfolio</h1>
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

      {validation && (
        <div style={{ marginTop: 32 }}>
          <h2>Create Distributor - Supplier Relationships</h2>
          
          {/* Relationship Cards */}
          <div style={{ marginTop: 24, display: 'grid', gap: 24 }}>
            {validation.relationshipDetails?.map((rel, index) => (
              <div key={index} style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr auto 1fr',
                gap: 24,
                alignItems: 'center',
                padding: 20,
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: 12
              }}>
                {/* Distributor Box */}
                <div style={{ 
                  padding: 16, 
                  background: '#f8fafc', 
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>Distributor</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                    {rel.distributorName}
                  </div>
                  <div style={{ 
                    fontSize: 12, 
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: rel.distributorExists ? '#d1fae5' : '#dbeafe',
                    color: rel.distributorExists ? '#065f46' : '#1e40af',
                    display: 'inline-block'
                  }}>
                    {rel.distributorExists ? '✓ Existing' : '+ New'}
                  </div>
                </div>

                {/* Connection Arrow */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: 24,
                  color: '#94a3b8'
                }}>
                  ↔
                </div>

                {/* Supplier Box */}
                <div style={{ 
                  padding: 16, 
                  background: '#f8fafc', 
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>Supplier</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                    {rel.supplierName}
                  </div>
                  <div style={{ 
                    fontSize: 12, 
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: rel.supplierExists ? '#d1fae5' : '#dbeafe',
                    color: rel.supplierExists ? '#065f46' : '#1e40af',
                    display: 'inline-block'
                  }}>
                    {rel.supplierExists ? '✓ Existing' : '+ New'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: 40, marginBottom: 16 }}>Validation Summary</h2>
          
          <div style={{ 
            padding: 20, 
            background: '#f8fafc', 
            border: '1px solid #e2e8f0',
            borderRadius: 8 
          }}>
            <div style={{ display: 'grid', gap: 16, fontSize: 14 }}>
              <SummaryItem
                label="Rows to process"
                count={validation.totalRows}
                onClick={() => setSelectedSummaryItem('rows')}
              />
              
              <SummaryItem
                label="New distributors to create"
                count={validation.newDistributors}
                items={validation.newDistributorsList}
                type="distributor"
                existingItems={validation.allExistingDistributors}
                onClick={() => setSelectedSummaryItem('newDistributors')}
              />
              
              <SummaryItem
                label="New suppliers to create"
                count={validation.newSuppliers}
                items={validation.newSuppliersList}
                type="supplier"
                existingItems={validation.allExistingSuppliers}
                onClick={() => setSelectedSummaryItem('newSuppliers')}
              />
              
              <SummaryItem
                label="New relationships to create"
                count={validation.newRelationships}
                onClick={() => setSelectedSummaryItem('newRelationships')}
              />
              
              <SummaryItem
                label="Existing relationships to verify"
                count={validation.existingRelationships}
                onClick={() => setSelectedSummaryItem('existingRelationships')}
              />
            </div>

            {validation.warnings && validation.warnings.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
                <p style={{ color: '#f59e0b', fontWeight: 500, marginBottom: 8 }}>⚠️ Warnings:</p>
                {validation.warnings.slice(0, 10).map((warn, i) => (
                  <p key={i} style={{ color: '#92400e', fontSize: 13, marginLeft: 16 }}>• {warn}</p>
                ))}
              </div>
            )}
          </div>

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

      {/* Match Modal */}
      <MatchModal
        isOpen={selectedSummaryItem !== null}
        onClose={() => setSelectedSummaryItem(null)}
        type={getModalData()?.type}
        items={getModalData()?.items}
        existingItems={getModalData()?.existingItems}
        onMatch={(itemName, existingItem) => {
          handleMatch(itemName, existingItem, getModalData()?.type);
        }}
      />
    </div>
  );
}

function SummaryItem({ label, count, items, type, existingItems, onClick }) {
  return (
    <div 
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '8px 12px',
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease'
      }}
      onClick={onClick}
      onMouseEnter={onClick ? (e) => {
        e.target.style.background = '#f8fafc';
        e.target.style.borderColor = '#cbd5e1';
      } : null}
      onMouseLeave={onClick ? (e) => {
        e.target.style.background = 'white';
        e.target.style.borderColor = '#e2e8f0';
      } : null}
    >
      <span style={{ color: '#64748b' }}>{label}:</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ 
          color: count > 0 ? (label.includes('New') ? '#3b82f6' : '#059669') : '#64748b',
          fontSize: 16
        }}>
          {count}
        </strong>
        {onClick && (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>👆 click to edit</span>
        )}
      </div>
    </div>
  );
}

function MatchModal({ isOpen, onClose, type, items, existingItems, onMatch }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        padding: 24,
        maxWidth: 600,
        maxHeight: '80vh',
        overflow: 'auto',
        width: '90%'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>
          Match {type === 'distributor' ? 'Distributors' : 'Suppliers'}
        </h3>
        
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 12 }}>
            Click on an item to match it to an existing {type}, or leave as "Create New"
          </p>
        </div>

        {items?.map((item, index) => (
          <div key={index} style={{
            padding: 12,
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            marginBottom: 8,
            background: '#f8fafc'
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {item}
            </div>
            
            <div style={{ display: 'grid', gap: 8 }}>
              <button
                style={{
                  padding: '8px 12px',
                  background: '#dbeafe',
                  color: '#1e40af',
                  border: '1px solid #93c5fd',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14
                }}
                onClick={() => onMatch(item, null)}
              >
                🆕 Create New: "{item}"
              </button>
              
              <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                ─── OR Match to Existing ───
              </div>
              
              <div style={{ display: 'grid', gap: 4, maxHeight: 200, overflow: 'auto' }}>
                {existingItems?.map(existing => (
                  <button
                    key={existing[`${type}_id`]}
                    style={{
                      padding: '6px 10px',
                      background: 'white',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13,
                      textAlign: 'left'
                    }}
                    onClick={() => onMatch(item, existing)}
                  >
                    ✓ {existing[`${type}_name`]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

