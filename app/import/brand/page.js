'use client';
import { useState } from 'react';
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

// Calculate similarity between two strings
function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
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

// Validate a batch of rows client-side
function validateBatch(rows, existingBrands, brandMap, firstWordMap, lengthIndexMap, THRESHOLD = 0.75) {
  const brandReviews = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const brandName = (row.brand_name || '').trim();
    
    if (!brandName) {
      brandReviews.push({
        rowIndex: i,
        brandName: '',
        error: 'Missing brand_name',
        matchType: 'error'
      });
      continue;
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
        for (const existing of candidates) {
          const sim = 0.95;
          if (sim > bestSimilarity) {
            suggestedMatch = existing;
            bestSimilarity = sim;
            matchedBrand = existing;
            matchType = 'fuzzy';
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
        
        // If we have too many candidates, limit to closest lengths
        if (candidates.length > 1000) {
          // Prioritize exact length matches, then closest
          candidates.sort((a, b) => {
            const aLen = normalizeName(a.brand_name).length;
            const bLen = normalizeName(b.brand_name).length;
            const aDiff = Math.abs(aLen - importLen);
            const bDiff = Math.abs(bLen - importLen);
            return aDiff - bDiff;
          });
          candidates.splice(1000); // Limit to top 1000 candidates
        }
        
        for (const existing of candidates) {
          const normalizedExisting = normalizeName(existing.brand_name);
          const sim = similarity(normalizedImportName, normalizedExisting);
          
          if (sim >= THRESHOLD && sim > bestSimilarity) {
            suggestedMatch = existing;
            bestSimilarity = sim;
            matchedBrand = existing;
            matchType = 'fuzzy';
            
            // Early exit if we find a very good match
            if (sim >= 0.95) break;
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

    brandReviews.push({
      rowIndex: i,
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
    });
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
    setProgress({ current: 0, total: parsed.length, message: 'Fetching existing brands...' });
    
    try {
      // Step 1: Fetch metadata once (existing brands, categories, sub-categories)
      const metadataResponse = await fetch('/api/import/brand/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadataOnly: true })
      });
      
      const metadata = await metadataResponse.json();
      
      if (metadata.error) {
        alert('Error fetching metadata: ' + metadata.error);
        setValidating(false);
        setProgress({ current: 0, total: 0, message: '' });
        return;
      }

      const allExistingBrands = metadata.allExistingBrands;
      const categories = metadata.categories;
      const subCategories = metadata.subCategories;

      // Create optimized lookup structures
      setProgress({
        current: 0,
        total: parsed.length,
        message: 'Preparing validation data...'
      });
      
      const brandMap = new Map();
      const firstWordMap = new Map();
      const lengthIndexMap = new Map(); // Index by normalized length for faster fuzzy matching
      
      for (const brand of allExistingBrands) {
        brandMap.set(brand.brand_name, brand);
        
        const firstWord = getFirstWord(brand.brand_name);
        if (firstWord && firstWord.length > 2) {
          if (!firstWordMap.has(firstWord)) {
            firstWordMap.set(firstWord, []);
          }
          firstWordMap.get(firstWord).push(brand);
        }
        
        // Index by normalized length
        const normalized = normalizeName(brand.brand_name);
        const len = normalized.length;
        if (!lengthIndexMap.has(len)) {
          lengthIndexMap.set(len, []);
        }
        lengthIndexMap.get(len).push(brand);
      }

      // Step 2: Process validation in batches client-side with progress updates
      const BATCH_SIZE = 100; // Process 100 rows at a time
      const batches = [];
      for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
        batches.push(parsed.slice(i, i + BATCH_SIZE));
      }

      let allBrandReviews = [];

      // Process batches with delays to keep browser responsive
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchStartIndex = i * BATCH_SIZE;
        
        setProgress({
          current: batchStartIndex,
          total: parsed.length,
          message: `Validating rows ${batchStartIndex + 1}-${Math.min(batchStartIndex + batch.length, parsed.length)} of ${parsed.length}...`
        });

        // Validate batch client-side
        const batchReviews = validateBatch(batch, allExistingBrands, brandMap, firstWordMap, lengthIndexMap);
        
        // Adjust row indices to match original positions
        const adjustedReviews = batchReviews.map(review => ({
          ...review,
          rowIndex: batchStartIndex + review.rowIndex
        }));
        
        allBrandReviews = [...allBrandReviews, ...adjustedReviews];

        // Yield to browser every batch to prevent UI blocking
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      setProgress({
        current: parsed.length,
        total: parsed.length,
        message: 'Validation complete!'
      });

      // Calculate summary
      const exactMatches = allBrandReviews.filter(b => b.matchType === 'exact');
      const fuzzyMatches = allBrandReviews.filter(b => b.matchType === 'fuzzy');
      const newBrands = allBrandReviews.filter(b => b.matchType === 'new');
      const errors = allBrandReviews.filter(b => b.matchType === 'error');

      const validationResult = {
        brandReviews: allBrandReviews,
        summary: {
          total: parsed.length,
          exact: exactMatches.length,
          fuzzy: fuzzyMatches.length,
          new: newBrands.length,
          errors: errors.length
        },
        allExistingBrands,
        categories,
        subCategories
      };
      
      setValidation(validationResult);
      
      // Initialize brand matches with defaults
      const matches = {};
      allBrandReviews.forEach(brand => {
        matches[brand.rowIndex] = {
          useExisting: brand.matchType === 'exact',
          existingBrandId: brand.matchedBrand?.brand_id,
          existingBrandName: brand.matchedBrand?.brand_name,
          importBrandName: brand.brandName
        };
      });
      setBrandMatches(matches);

      // Clear progress after a short delay
      setTimeout(() => {
        setProgress({ current: 0, total: 0, message: '' });
      }, 1000);
    } catch (error) {
      console.error('Validation error:', error);
      alert('Validation failed: ' + error.message);
      setProgress({ current: 0, total: 0, message: '' });
    } finally {
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

      let totalBrandsCreated = 0;
      let totalBrandsUpdated = 0;
      let totalCategoriesLinked = 0;
      let totalSubCategoriesLinked = 0;
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

        totalBrandsCreated += result.brandsCreated || 0;
        totalBrandsUpdated += result.brandsUpdated || 0;
        totalCategoriesLinked += result.categoriesLinked || 0;
        totalSubCategoriesLinked += result.subCategoriesLinked || 0;
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
        brandsCreated: totalBrandsCreated,
        brandsUpdated: totalBrandsUpdated,
        categoriesLinked: totalCategoriesLinked,
        subCategoriesLinked: totalSubCategoriesLinked,
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
                {Math.round((progress.current / progress.total) * 100)}%
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

                {/* Exact Matches - Ignore */}
                {exactMatches.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                    <div style={{ padding: '12px 16px', background: '#d1fae5', borderBottom: '1px solid #10b981' }}>
                      <strong style={{ color: '#065f46' }}>✓ Exact Match - Enrich ({exactMatches.length})</strong>
                      <span style={{ fontSize: 13, color: '#065f46', marginLeft: 8 }}>
                        - Will add missing data (URL, logo, categories) without replacing existing data
                      </span>
                    </div>
                    {exactMatches.map((brand, idx) => (
                      <BrandRow 
                        key={idx} 
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
                    {fuzzyMatches.map((brand, idx) => (
                      <BrandRow 
                        key={idx} 
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
                    {newBrands.map((brand, idx) => (
                      <BrandRow 
                        key={idx} 
                        brand={brand} 
                        brandMatches={brandMatches}
                        validation={validation}
                        handleManualMatch={handleManualMatch}
                        updateMatch={updateMatch}
                      />
                    ))}
                  </div>
                )}
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
          background: '#f0fdf4', 
          border: '1px solid #86efac',
          borderRadius: 8 
        }}>
          <h3 style={{ marginTop: 0, color: '#166534' }}>Import Complete</h3>
          <div style={{ display: 'grid', gap: 8, fontSize: 14, color: '#166534' }}>
            <p>✅ Brands created: {results.brandsCreated}</p>
            <p>✅ Brands enriched: {results.brandsUpdated}</p>
            <p>✅ Categories linked: {results.categoriesLinked}</p>
            <p>✅ Sub-categories linked: {results.subCategoriesLinked}</p>
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
