'use client';
import { useState } from 'react';

export default function AddSupplierPage() {
  const [formData, setFormData] = useState({
    supplier_name: '',
    supplier_url: '',
    supplier_logo_url: ''
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
    
    if (!formData.supplier_name.trim()) {
      setError('Supplier name is required');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/import/add-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add supplier');
      }
      
      setResult(data);
      setFormData({
        supplier_name: '',
        supplier_url: '',
        supplier_logo_url: ''
      });
    } catch (error) {
      console.error('Error adding supplier:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Add Supplier</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>
        Add a new supplier to the core_suppliers table. All fields except supplier name are optional.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#374151' }}>
            Supplier Name *
          </label>
          <input
            type="text"
            name="supplier_name"
            value={formData.supplier_name}
            onChange={handleInputChange}
            placeholder="Enter supplier name"
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
            Supplier URL
          </label>
          <input
            type="url"
            name="supplier_url"
            value={formData.supplier_url}
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
            Supplier Logo URL
          </label>
          <input
            type="url"
            name="supplier_logo_url"
            value={formData.supplier_logo_url}
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
          disabled={loading || !formData.supplier_name.trim()}
          style={{
            padding: '12px 24px',
            background: (loading || !formData.supplier_name.trim()) ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: (loading || !formData.supplier_name.trim()) ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            fontSize: 16,
            minWidth: 120
          }}
        >
          {loading ? 'Adding...' : 'Add Supplier'}
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
          <h3 style={{ marginTop: 0, color: '#166534' }}>Supplier Added Successfully</h3>
          <div style={{ display: 'grid', gap: 8, fontSize: 14, color: '#166534' }}>
            <p>✅ Supplier ID: {result.supplier_id}</p>
            <p>✅ Supplier Name: {result.supplier_name}</p>
            {result.supplier_url && <p>✅ URL: {result.supplier_url}</p>}
            {result.supplier_logo_url && <p>✅ Logo URL: {result.supplier_logo_url}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
