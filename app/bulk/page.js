'use client';
import { useState } from 'react';
import { Button } from '@/components/FormField';

function parseCSV(text) {
  const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const headers = headerLine.split(',').map(h => h.trim());
  return lines.map(line => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h,i)=>row[h]=cols[i]?.trim());
    return row;
  });
}

export default function BulkPage() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRows(parseCSV(String(reader.result)));
    reader.readAsText(file);
  }

  async function upload() {
    if (!rows.length) return alert('No rows found');
    setStatus('Uploading...');
    const res = await fetch('/api/bulk/brand-supplier-states', {
      method: 'POST',
      body: JSON.stringify({ rows })
    });
    setStatus(res.ok ? 'Upload complete ✅' : 'Upload failed ❌');
  }

  return (
    <div>
      <h1>Bulk Import / Edit</h1>
      <p>Upload a CSV with columns:
        <code>brand_id,supplier_id,state_id,is_verified,last_verified_at,relationship_source,created_at</code>
      </p>
      <input type="file" accept=".csv" onChange={onFile} />
      {rows.length>0 && (
        <div style={{marginTop:16}}>
          <Button onClick={upload}>Upload {rows.length} rows</Button>
          <span style={{marginLeft:12}}>{status}</span>
        </div>
      )}
    </div>
  );
}
