'use client';

import { useState, useMemo } from 'react';
import Papa from 'papaparse';

const TEMPLATE_HEADERS = [
  'brand_name',
  'brand_url',
  'brand_logo_url',
  'brand_supplier',         // parsed but committed later
  'brand_distributor',      // e.g. "RNDC:CA,TX; SGWS:FL" — parsed but committed later
  'brand_categories',       // "Tequila, Vodka"
  'brand_sub_categories',   // "Blanco, Añejo"
  'data_source'             // "csv_import" etc.
];

export default function ImportBrandPage() {
  const [rows, setRows] = useState([]);          // parsed + editable
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [committing, setCommitting] = useState(false);

  const handleFiles = (file) => {
    setError('');
    setInfo('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        // Validate headers
        const headers = Object.keys(res.data?.[0] || {}).map(h => h.trim());
        const missing = TEMPLATE_HEADERS.filter(h => !headers.includes(h));
        if (missing.length) {
          setError(`Missing required columns: ${missing.join(', ')}`);
          setRows([]);
          return;
        }
        // Normalize rows (trim)
        const clean = res.data.map(r => {
          const o = {};
          TEMPLATE_HEADERS.forEach(h => { o[h] = (r[h] ?? '').toString().trim(); });
          return o;
        });
        setRows(clean);
        setInfo(`Parsed ${clean.length} row(s). Click cells to edit; then Commit.`);
      },
      error: (err) => setError(err.message)
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFiles(f);
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFiles(f);
  };

  const updateCell = (idx, key, val) => {
    setRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: val };
      return copy;
    });
  };

  const invalidCount = useMemo(() => {
    return rows.filter(r => !r.brand_name).length;
  }, [rows]);

  const commit = async () => {
    setCommitting(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'brand',
          rows
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Commit failed');
      setInfo(`Imported: ${json.inserted} inserted, ${json.updated} updated, ${json.linked} links created, ${json.skipped} skipped`);
    } catch (e) {
      setError(e.message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>Import Brand</h1>
      <p style={{ color:'#64748b', marginTop:8 }}>
        Template columns: {TEMPLATE_HEADERS.join(', ')}
      </p>

      <div
        onDrop={onDrop}
        onDragOver={(e)=>e.preventDefault()}
        style={{
          marginTop:16, border:'2px dashed #94a3b8', borderRadius:12, padding:24,
          background:'#f8fafc'
        }}
      >
        <input type="file" accept=".csv" onChange={onFile} />
        <p style={{ color:'#64748b', marginTop:8 }}>
          Drag & drop a CSV here, or choose a file.
        </p>
      </div>

      {error && <div style={{ marginTop:16, color:'#b91c1c' }}>⚠️ {error}</div>}
      {info && <div style={{ marginTop:16, color:'#065f46' }}>✅ {info}</div>}

      {rows.length > 0 && (
        <>
          <div style={{ display:'flex', gap:12, marginTop:16 }}>
            <button
              disabled={committing || invalidCount>0}
              onClick={commit}
              style={{
                background: committing || invalidCount>0 ? '#94a3b8' : '#0ea5e9',
                color:'white', border:'none', padding:'10px 14px', borderRadius:8, cursor:'pointer'
              }}
            >
              {committing ? 'Committing…' : 'Commit to Database'}
            </button>
            {invalidCount>0 && (
              <span style={{ color:'#b45309' }}>
                {invalidCount} row(s) missing <code>brand_name</code>
              </span>
            )}
          </div>

          <div style={{ overflow:'auto', marginTop:16, border:'1px solid #e2e8f0', borderRadius:8 }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ background:'#f1f5f9' }}>
                <tr>
                  {TEMPLATE_HEADERS.map(h => (
                    <th key={h} style={{ textAlign:'left', padding:10, fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} style={{ borderTop:'1px solid #e2e8f0' }}>
                    {TEMPLATE_HEADERS.map(key => (
                      <td key={key} style={{ padding:8 }}>
                        <input
                          value={r[key] || ''}
                          onChange={(e)=>updateCell(idx, key, e.target.value)}
                          style={{ width:'100%', padding:6, border:'1px solid #cbd5e1', borderRadius:6 }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}