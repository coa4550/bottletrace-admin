'use client';
import { useState } from 'react';

export default function AddDistributorPage() {
  const [formData, setFormData] = useState({
    distributor_name: '',
    distributor_url: '',
    distributor_logo_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.distributor_name.trim()) {
      setError('Distributor name is required');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/import/add-distributor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add distributor');
      }
      
      setResult(data);
      setFormData({
        distributor_name: '',
        distributor_url: '',
        distributor_logo_url: ''
      });
    } catch (error) {
      console.error('Error adding distributor:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Add Distributor</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>
        Add a new distributor to the core_distributors table. All fields except distributor name are optional.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#374151' }}>
            Distributor Name *
          </label>
          <input
            type="text"
            name="distributor_name"
            value={formData.distributor_name}
            onChange={handleInputChange}
            placeholder="Enter distributor name"
            required
            style={{
              width: '100%',
              maxWidth: 400,
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              background: 'white'
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#374151' }}>
            Distributor URL
          </label>
          <input
            type="url"
            name="distributor_url"
            value={formData.distributor_url}
            onChange={handleInputChange}
            placeholder="https://example.com"
            style={{
              width: '100%',
              maxWidth: 400,
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              background: 'white'
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#374151' }}>
            Distributor Logo URL
          </label>
          <input
            type="url"
            name="distributor_logo_url"
            value={formData.distributor_logo_url}
            onChange={handleInputChange}
            placeholder="https://example.com/logo.png"
            style={{
              width: '100%',
              maxWidth: 400,
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              background: 'white'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !formData.distributor_name.trim()}
          style={{
            padding: '12px 24px',
            background: (loading || !formData.distributor_name.trim()) ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: (loading || !formData.distributor_name.trim()) ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            fontSize: 16,
            minWidth: 120
          }}
        >
          {loading ? 'Adding...' : 'Add Distributor'}
        </button>
      </form>

      {error && (
        <div style={{ 
          marginTop: 24, 
          padding: 16, 
          background: '#fef2f2', 
          border: '1px solid #fca5a5',
          borderRadius: 8,
          color: '#dc2626'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ 
          marginTop: 24, 
          padding: 20, 
          background: '#f0fdf4', 
          border: '1px solid #86efac',
          borderRadius: 8 
        }}>
          <h3 style={{ marginTop: 0, color: '#166534' }}>Distributor Added Successfully</h3>
          <div style={{ display: 'grid', gap: 8, fontSize: 14, color: '#166534' }}>
            <p>✅ Distributor ID: {result.distributor_id}</p>
            <p>✅ Distributor Name: {result.distributor_name}</p>
            {result.distributor_url && <p>✅ URL: {result.distributor_url}</p>}
            {result.distributor_logo_url && <p>✅ Logo URL: {result.distributor_logo_url}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
