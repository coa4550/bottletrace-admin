'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

// Normalize brand names for fuzzy matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

// Get first significant word from brand name (excluding "the")
function getFirstWord(name) {
  const normalized = normalizeName(name);
  const words = normalized.split(' ').filter(w => w.length > 0);
  
  if (words.length > 0 && words[0] === 'the') {
    return words[1] || words[0];
  }
  
  return words[0] || '';
}

// Fast similarity check using character set overlap (much faster than Levenshtein)
function fastSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1.0;
  
  // Quick length-based check
  const lenDiff = Math.abs(len1 - len2);
  if (lenDiff > maxLen * 0.5) return 0; // Too different in length
  
  // Character overlap
  const chars1 = new Set(s1);
  const chars2 = new Set(s2);
  let intersection = 0;
  let union = chars1.size;
  
  for (const char of chars2) {
    if (chars1.has(char)) {
      intersection++;
    } else {
      union++;
    }
  }
  
  const jaccard = intersection / union;
  
  // Also check prefix/suffix similarity for better accuracy
  const minLen = Math.min(len1, len2);
  let prefixMatch = 0;
  let suffixMatch = 0;
  
  for (let i = 0; i < Math.min(10, minLen); i++) {
    if (s1[i] === s2[i]) prefixMatch++;
    if (s1[len1 - 1 - i] === s2[len2 - 1 - i]) suffixMatch++;
  }
  
  const prefixScore = prefixMatch / Math.min(10, minLen);
  const suffixScore = suffixMatch / Math.min(10, minLen);
  
  // Weighted combination
  return (jaccard * 0.6 + prefixScore * 0.2 + suffixScore * 0.2);
}

// Calculate similarity between two strings (use Levenshtein only for short strings)
function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  // For short strings, use Levenshtein for accuracy
  if (longer.length <= 15) {
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  // For longer strings, use fast approximation
  return fastSimilarity(s1, s2);
}

function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Validate a single row
function validateRow(row, rowIndex, brandMap, firstWordMap, lengthIndexMap, THRESHOLD = 0.75) {
    const brandName = (row.brand_name || '').trim();
    
    if (!brandName) {
      return {
        rowIndex,
        brandName: '',
        error: 'Missing brand_name',
        matchType: 'error'
      };
    }

    // Check for exact match using Map (O(1) lookup)
    let matchedBrand = brandMap.get(brandName);
    let matchType = 'new';
    let suggestedMatch = null;
    let bestSimilarity = 0;

    if (matchedBrand) {
      matchType = 'exact';
    } else {
      // Check for first word match first (faster)
      const importFirstWord = getFirstWord(brandName);
      if (importFirstWord && importFirstWord.length > 2 && firstWordMap.has(importFirstWord)) {
        const candidates = firstWordMap.get(importFirstWord);
        // Limit first word candidates aggressively to prevent slowdown
        const maxFirstWordCandidates = Math.min(50, candidates.length);
        for (let i = 0; i < maxFirstWordCandidates; i++) {
          const existing = candidates[i];
          const sim = 0.95;
          if (sim > bestSimilarity) {
            suggestedMatch = existing;
            bestSimilarity = sim;
            matchedBrand = existing;
            matchType = 'fuzzy';
            break; // Early exit - first word match is good enough
          }
        }
      }
      
      // If no first word match found, do fuzzy matching
      if (!suggestedMatch) {
        const normalizedImportName = normalizeName(brandName);
        const importLen = normalizedImportName.length;
        
        // Only check brands with similar length to optimize
        const minLen = Math.max(1, Math.floor(importLen * 0.7));
        const maxLen = Math.ceil(importLen * 1.3);
        
        // Collect candidates from length index
        const candidates = [];
        for (let len = minLen; len <= maxLen; len++) {
          if (lengthIndexMap.has(len)) {
            candidates.push(...lengthIndexMap.get(len));
          }
        }
        
        // Limit candidates aggressively to prevent slowdown
        if (candidates.length > 100) {
          // Prioritize exact length matches, then closest
          candidates.sort((a, b) => {
            const aLen = normalizeName(a.brand_name).length;
            const bLen = normalizeName(b.brand_name).length;
            const aDiff = Math.abs(aLen - importLen);
            const bDiff = Math.abs(bLen - importLen);
            return aDiff - bDiff;
          });
          candidates.splice(100); // Limit to top 100 candidates for speed
        }
        
        // Process candidates with early exit - limit iterations strictly for performance
        const maxIterations = 100;
        for (let idx = 0; idx < Math.min(candidates.length, maxIterations); idx++) {
          const existing = candidates[idx];
          const normalizedExisting = normalizeName(existing.brand_name);
          
          // Quick length check before similarity calculation
          if (Math.abs(normalizedExisting.length - normalizedImportName.length) > normalizedImportName.length * 0.4) {
            continue; // Skip if length difference is too large
          }
          
          const sim = similarity(normalizedImportName, normalizedExisting);
          
          if (sim >= THRESHOLD && sim > bestSimilarity) {
            suggestedMatch = existing;
            bestSimilarity = sim;
            matchedBrand = existing;
            matchType = 'fuzzy';
            
            // Early exit if we find a very good match
            if (sim >= 0.80) break; // Lower threshold for earlier exit
          }
        }
      }
    }

    // Parse categories and sub-categories
    const categoriesArray = (row.brand_categories || '')
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);
    
    const subCategoriesArray = (row.brand_sub_categories || '')
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    return {
      rowIndex,
      brandName,
      brandUrl: (row.brand_url || '').trim(),
      brandLogoUrl: (row.brand_logo_url || '').trim(),
      dataSource: (row.data_source || 'csv_import').trim(),
      categories: categoriesArray,
      subCategories: subCategoriesArray,
      matchType,
      matchedBrand: matchedBrand ? {
        brand_id: matchedBrand.brand_id,
        brand_name: matchedBrand.brand_name,
        brand_url: matchedBrand.brand_url,
        brand_logo_url: matchedBrand.brand_logo_url,
        data_source: matchedBrand.data_source
      } : null,
      similarity: matchType === 'fuzzy' ? bestSimilarity : null,
      action: matchType === 'new' ? 'create' : (matchType === 'exact' ? 'update' : 'match')
    };
}

// Validate a batch of rows client-side
function validateBatch(rows, existingBrands, brandMap, firstWordMap, lengthIndexMap, THRESHOLD = 0.75) {
  const brandReviews = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const review = validateRow(row, i, brandMap, firstWordMap, lengthIndexMap, THRESHOLD);
    brandReviews.push(review);
  }

  return brandReviews;
}

export default function ImportBrandPage() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [validation, setValidation] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [brandMatches, setBrandMatches] = useState({});
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (window._validationPollInterval) {
        clearInterval(window._validationPollInterval);
      }
    };
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setValidation(null);
    setResults(null);
    setBrandMatches({});
    setCurrentPage(0);
    // Clean up any existing polling
    if (window._validationPollInterval) {
      clearInterval(window._validationPollInterval);
      window._validationPollInterval = null;
    }
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
    setValidating(true);
    setProgress({ current: 0, total: parsed.length, message: 'Starting validation...' });
    
    try {
      // Start server-side validation job
      const response = await fetch('/api/import/brand/validate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed })
      });
      
      const { jobId, error } = await response.json();
      
      if (error || !jobId) {
        alert('Error starting validation: ' + (error || 'Unknown error'));
        setValidating(false);
        setProgress({ current: 0, total: 0, message: '' });
        return;
      }

      // Poll for progress
      let pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/import/brand/validate-stream?jobId=${jobId}`);
          const status = await statusResponse.json();
          
          if (status.error) {
            clearInterval(pollInterval);
            alert('Validation error: ' + status.error);
            setValidating(false);
            setProgress({ current: 0, total: 0, message: '' });
            return;
          }

          // Update progress
          setProgress({
            current: status.progress || 0,
            total: status.total || parsed.length,
            message: status.message || 'Validating...'
          });

          // If complete, process results
          if (status.status === 'complete' && status.results) {
            clearInterval(pollInterval);
            
            // Initialize brand matches
            const matches = {};
            status.results.brandReviews.forEach(brand => {
              matches[brand.rowIndex] = {
                useExisting: brand.matchType === 'exact',
                existingBrandId: brand.matchedBrand?.brand_id,
                existingBrandName: brand.matchedBrand?.brand_name,
                importBrandName: brand.brandName
              };
            });
            
            setBrandMatches(matches);
            setValidation(status.results);
            setCurrentPage(0); // Reset pagination
            
            setProgress({
              current: status.total,
              total: status.total,
              message: 'Validation complete!'
            });

            // Clear progress after a delay
            setTimeout(() => {
              setProgress({ current: 0, total: 0, message: '' });
            }, 1000);
            
            setValidating(false);
          } else if (status.status === 'error') {
            clearInterval(pollInterval);
            alert('Validation failed: ' + (status.error || 'Unknown error'));
            setValidating(false);
            setProgress({ current: 0, total: 0, message: '' });
          }
        } catch (error) {
          console.error('Polling error:', error);
          // Don't clear interval on network errors, keep polling
        }
      }, 500); // Poll every 500ms

      // Store interval reference for cleanup
      window._validationPollInterval = pollInterval;
    } catch (error) {
      console.error('Validation error:', error);
      alert('Validation failed: ' + error.message);
      setProgress({ current: 0, total: 0, message: '' });
      setValidating(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setProgress({ current: 0, total: parsed.length, message: 'Starting import...' });
    
    try {
      const BATCH_SIZE = 10;
      const batches = [];
      for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
        batches.push(parsed.slice(i, i + BATCH_SIZE));
      }

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

        // Extract confirmed matches for this batch
        const batchMatches = {};
        batch.forEach((_, idx) => {
          const originalIndex = batchStartIndex + idx;
          if (brandMatches[originalIndex]) {
            batchMatches[idx] = brandMatches[originalIndex];
          }
        });

        const response = await fetch('/api/import/brand', {
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
        
        if (i === 0 && result.importLogId) {
          importLogId = result.importLogId;
        }

        if (result.error) {
          allErrors.push(`Batch ${i + 1}: ${result.error}`);
        } else {
          totalSkipped += result.skipped || 0;
          if (result.errors && result.errors.length > 0) {
            allErrors = [...allErrors, ...result.errors];
          }
        }
      }

      setProgress({
        current: parsed.length,
        total: parsed.length,
        message: 'Import complete!'
      });

      setResults({
        rowsProcessed: parsed.length - totalSkipped,
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

  return (
    <div style={{ padding: 20 }}>
      <h1>Import Brands</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>
        Upload a spreadsheet with brand data. Expected columns: brand_name, brand_url, brand_logo_url, brand_categories, brand_sub_categories, data_source
      </p>
      <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
        💡 <strong>Note:</strong> Categories and sub-categories should be comma-separated (e.g., "Tequila, Vodka" or "Blanco, Añejo").
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
        disabled={validating || loading || parsed.length === 0}
        style={{
          marginTop: 16,
          padding: '10px 20px',
          background: (validating || loading || parsed.length === 0) ? '#94a3b8' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: (validating || loading || parsed.length === 0) ? 'not-allowed' : 'pointer',
          fontWeight: 500
        }}
      >
        {validating ? 'Validating...' : 'Validate & Review Changes'}
      </button>

      {/* Validation Progress Bar */}
      {validating && progress.total > 0 && (
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
              background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
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
                {Math.min(100, Math.round((progress.current / progress.total) * 100))}%
              </span>
            </div>
          </div>
        </div>
      )}

      {validation && validation.brandReviews && (
        <div style={{ marginTop: 32 }}>
          <h2>Review Import Changes</h2>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            Review all brands below. You can manually adjust matches before importing.
          </p>

          {(() => {
            const exactMatches = validation.brandReviews.filter(b => b.matchType === 'exact');
            const fuzzyMatches = validation.brandReviews.filter(b => b.matchType === 'fuzzy');
            const newBrands = validation.brandReviews.filter(b => b.matchType === 'new');

            // Pagination helper
            const PaginatedSection = ({ title, items, bgColor, borderColor, textColor, description }) => {
              const [page, setPage] = useState(0);
              const startIdx = page * itemsPerPage;
              const endIdx = startIdx + itemsPerPage;
              const paginatedItems = items.slice(startIdx, endIdx);
              const totalPages = Math.ceil(items.length / itemsPerPage);

              if (items.length === 0) return null;

              return (
                <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                  <div style={{ padding: '12px 16px', background: bgColor, borderBottom: `1px solid ${borderColor}` }}>
                    <strong style={{ color: textColor }}>{title} ({items.length})</strong>
                    <span style={{ fontSize: 13, color: textColor, marginLeft: 8 }}>
                      {description}
                    </span>
                  </div>
                  {paginatedItems.map((brand, idx) => (
                    <BrandRow 
                      key={brand.rowIndex} 
                      brand={brand} 
                      brandMatches={brandMatches}
                      validation={validation}
                      handleManualMatch={handleManualMatch}
                      updateMatch={updateMatch}
                    />
                  ))}
                  {totalPages > 1 && (
                    <div style={{ 
                      padding: '12px 16px', 
                      background: '#f8fafc', 
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ fontSize: 14, color: '#64748b' }}>
                        Showing {startIdx + 1}-{Math.min(endIdx, items.length)} of {items.length}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setPage(p => Math.max(0, p - 1))}
                          disabled={page === 0}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            background: page === 0 ? '#f1f5f9' : 'white',
                            cursor: page === 0 ? 'not-allowed' : 'pointer',
                            color: page === 0 ? '#94a3b8' : '#334155'
                          }}
                        >
                          Previous
                        </button>
                        <span style={{ padding: '6px 12px', fontSize: 14, color: '#64748b' }}>
                          Page {page + 1} of {totalPages}
                        </span>
                        <button
                          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                          disabled={page >= totalPages - 1}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            background: page >= totalPages - 1 ? '#f1f5f9' : 'white',
                            cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                            color: page >= totalPages - 1 ? '#94a3b8' : '#334155'
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <>
                {/* Column Headers */}
                <div style={{ border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    <div style={{ padding: '12px 16px', borderRight: '2px solid #cbd5e1' }}>
                      <strong>Import Brands</strong>
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                      <strong>Existing Brands</strong>
                    </div>
                  </div>
                </div>

                {/* Exact Matches - Paginated */}
                <PaginatedSection
                  title="✓ Exact Match - Enrich"
                  items={exactMatches}
                  bgColor="#d1fae5"
                  borderColor="#10b981"
                  textColor="#065f46"
                  description="- Will add missing data (URL, logo, categories) without replacing existing data"
                />

                {/* Fuzzy Matches - Paginated */}
                <PaginatedSection
                  title="~ Fuzzy Match - Confirm"
                  items={fuzzyMatches}
                  bgColor="#fef3c7"
                  borderColor="#fbbf24"
                  textColor="#92400e"
                  description="- Review and confirm matches"
                />

                {/* New Brands - Paginated */}
                <PaginatedSection
                  title="+ New Brand - Add"
                  items={newBrands}
                  bgColor="#dbeafe"
                  borderColor="#3b82f6"
                  textColor="#1e40af"
                  description="- Will create these brands"
                />
              </>
            );
          })()}

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
          background: '#fef3c7', 
          border: '1px solid #fbbf24',
          borderRadius: 8 
        }}>
          <h3 style={{ marginTop: 0, color: '#92400e' }}>Data Imported to Staging</h3>
          <div style={{ display: 'grid', gap: 8, fontSize: 14, color: '#92400e' }}>
            <p>✅ Rows processed: {results.rowsProcessed || 0}</p>
            <p>⚠️ Rows skipped: {results.skipped || 0}</p>
            {results.errors && results.errors.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontWeight: 500 }}>Errors:</p>
                {results.errors.map((err, i) => (
                  <p key={i} style={{ color: '#dc2626', fontSize: 13 }}>• {err}</p>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #fbbf24' }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>Next Steps:</p>
              <a 
                href="/staging/review/brands"
                style={{ 
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: '#f59e0b',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 14,
                  marginTop: 8
                }}
              >
                📋 Review & Migrate Staging Data
              </a>
              {results.importLogId && (
                <div style={{ marginTop: 12 }}>
                  <a 
                    href={`/import/logs/${results.importLogId}`}
                    style={{ color: '#92400e', textDecoration: 'underline', fontSize: 13 }}
                  >
                    View detailed import log
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BrandRow({ brand, brandMatches, validation, handleManualMatch, updateMatch }) {
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong style={{ fontSize: 15 }}>{brand.brandName}</strong>
          {brand.brandUrl && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              🔗 {brand.brandUrl}
            </div>
          )}
          {brand.categories && brand.categories.length > 0 && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              📁 {brand.categories.join(', ')}
            </div>
          )}
          {brand.subCategories && brand.subCategories.length > 0 && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              🏷️ {brand.subCategories.join(', ')}
            </div>
          )}
          {isFuzzy && brand.similarity && (
            <div style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>
              {Math.round(brand.similarity * 100)}% similar to suggested match
            </div>
          )}
        </div>
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
