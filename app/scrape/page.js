'use client';
import { useState } from 'react';

export default function ScrapePage() {
  const [url, setUrl] = useState('');
  const [fields, setFields] = useState(['brands', 'categories', 'logos']);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  function toggle(field) {
    setFields((prev) => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setDownloading(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, fields })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed: ${res.status}`);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'scrape-result.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  const all = [
    { key: 'brands', label: 'Brands' },
    { key: 'categories', label: 'Categories' },
    { key: 'logos', label: 'Logos' },
    { key: 'descriptions', label: 'Descriptions' },
    { key: 'homepages', label: 'Homepages' },
    { key: 'country', label: 'Country' }
  ];

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 16 }}>Web Scraper</h1>
      <p style={{ marginBottom: 24, color: '#64748b' }}>
        Paste a URL to scrape brand data using OpenAI and Bright Data. Returns a ZIP file with CSV data and downloaded logo images.
      </p>
      
      <form onSubmit={handleSubmit} style={{ maxWidth: 800 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Page URL
          </label>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/brands"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: 14,
              fontFamily: 'inherit'
            }}
          />
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Fields to extract
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {all.map(({ key, label }) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  backgroundColor: fields.includes(key) ? '#f0f9ff' : 'white',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!fields.includes(key)) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!fields.includes(key)) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={fields.includes(key)}
                  onChange={() => toggle(key)}
                  style={{ cursor: 'pointer' }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        
        <button
          type="submit"
          disabled={downloading}
          style={{
            padding: '12px 24px',
            borderRadius: 6,
            backgroundColor: downloading ? '#94a3b8' : '#0d9488',
            color: 'white',
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: downloading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!downloading) {
              e.currentTarget.style.backgroundColor = '#059669';
            }
          }}
          onMouseLeave={(e) => {
            if (!downloading) {
              e.currentTarget.style.backgroundColor = '#0d9488';
            }
          }}
        >
          {downloading ? 'Scraping…' : 'Scrape & Download ZIP'}
        </button>
        
        {error && (
          <div style={{
            marginTop: 16,
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            color: '#991b1b',
            fontSize: 14
          }}>
            {error}
          </div>
        )}
      </form>
      
      <div style={{
        marginTop: 32,
        padding: '16px',
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        border: '1px solid #e2e8f0'
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          <strong>Note:</strong> Returns a ZIP file containing <code>result.csv</code> and a <code>/logos</code> folder with downloaded logo images when logo URLs are available.
        </p>
      </div>
    </div>
  );
}

