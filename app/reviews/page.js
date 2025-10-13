'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import SearchInput from '@/components/SearchInput';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colWidths, setColWidths] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reviewColWidths');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, brand, supplier, distributor
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, approved, denied
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  async function fetchReviews() {
    try {
      // Fetch all review types
      const [brandReviews, supplierReviews, distributorReviews] = await Promise.all([
        supabase
          .from('brand_reviews')
          .select(`
            brand_review_id,
            user_id,
            rating,
            title,
            content,
            pull_through_rate,
            gross_margin,
            sales_support,
            brand_recognition,
            sustainability,
            created_at,
            updated_at,
            brand_id,
            status,
            reviewed_at,
            reviewed_by,
            review_notes,
            core_brands!inner(brand_name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('supplier_reviews')
          .select(`
            supplier_review_id,
            user_id,
            rating,
            title,
            content,
            reliability,
            communication,
            product_quality,
            delivery_speed,
            pricing,
            created_at,
            updated_at,
            supplier_id,
            status,
            reviewed_at,
            reviewed_by,
            review_notes,
            core_suppliers!inner(supplier_name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('distributor_reviews')
          .select(`
            distributor_review_id,
            user_id,
            rating,
            title,
            content,
            availability,
            customer_service,
            delivery_reliability,
            pricing_competitiveness,
            product_selection,
            created_at,
            updated_at,
            distributor_id,
            status,
            reviewed_at,
            reviewed_by,
            review_notes,
            core_distributors!inner(distributor_name)
          `)
          .order('created_at', { ascending: false })
      ]);

      if (brandReviews.error) throw brandReviews.error;
      if (supplierReviews.error) throw supplierReviews.error;
      if (distributorReviews.error) throw distributorReviews.error;

      // Get user profiles for all reviewers
      const allUserIds = [
        ...(brandReviews.data || []).map(r => r.user_id),
        ...(supplierReviews.data || []).map(r => r.user_id),
        ...(distributorReviews.data || []).map(r => r.user_id)
      ];
      const uniqueUserIds = [...new Set(allUserIds)];

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', uniqueUserIds);

      const userMap = {};
      profiles?.forEach(p => {
        userMap[p.user_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown User';
      });

      // Normalize all reviews into a single array
      const allReviews = [
        ...(brandReviews.data || []).map(r => ({
          id: r.brand_review_id,
          type: 'Brand',
          review_type: 'brand',
          entity_name: r.core_brands?.brand_name || 'Unknown',
          user_name: userMap[r.user_id] || 'Unknown User',
          rating: r.rating,
          title: r.title,
          content: r.content,
          created_at: r.created_at,
          updated_at: r.updated_at,
          user_id: r.user_id,
          entity_id: r.brand_id,
          status: r.status || 'approved',
          reviewed_at: r.reviewed_at,
          reviewed_by: r.reviewed_by,
          review_notes: r.review_notes,
          category_ratings: {
            'Pull Through': r.pull_through_rate,
            'Gross Margin': r.gross_margin,
            'Sales Support': r.sales_support,
            'Brand Recognition': r.brand_recognition,
            'Sustainability': r.sustainability
          }
        })),
        ...(supplierReviews.data || []).map(r => ({
          id: r.supplier_review_id,
          type: 'Supplier',
          review_type: 'supplier',
          entity_name: r.core_suppliers?.supplier_name || 'Unknown',
          user_name: userMap[r.user_id] || 'Unknown User',
          rating: r.rating,
          title: r.title,
          content: r.content,
          created_at: r.created_at,
          updated_at: r.updated_at,
          user_id: r.user_id,
          entity_id: r.supplier_id,
          status: r.status || 'approved',
          reviewed_at: r.reviewed_at,
          reviewed_by: r.reviewed_by,
          review_notes: r.review_notes,
          category_ratings: {
            'Reliability': r.reliability,
            'Communication': r.communication,
            'Product Quality': r.product_quality,
            'Delivery Speed': r.delivery_speed,
            'Pricing': r.pricing
          }
        })),
        ...(distributorReviews.data || []).map(r => ({
          id: r.distributor_review_id,
          type: 'Distributor',
          review_type: 'distributor',
          entity_name: r.core_distributors?.distributor_name || 'Unknown',
          user_name: userMap[r.user_id] || 'Unknown User',
          rating: r.rating,
          title: r.title,
          content: r.content,
          created_at: r.created_at,
          updated_at: r.updated_at,
          user_id: r.user_id,
          entity_id: r.distributor_id,
          status: r.status || 'approved',
          reviewed_at: r.reviewed_at,
          reviewed_by: r.reviewed_by,
          review_notes: r.review_notes,
          category_ratings: {
            'Availability': r.availability,
            'Customer Service': r.customer_service,
            'Delivery Reliability': r.delivery_reliability,
            'Pricing Competitiveness': r.pricing_competitiveness,
            'Product Selection': r.product_selection
          }
        }))
      ];

      setReviews(allReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  }

  const startResize = (e, key) => {
    const startX = e.clientX;
    const startWidth = colWidths[key] || 150;

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(60, startWidth + moveEvent.clientX - startX);
      setColWidths((prev) => {
        const updated = { ...prev, [key]: newWidth };
        localStorage.setItem('reviewColWidths', JSON.stringify(updated));
        return updated;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleApprove = async (review) => {
    if (!confirm('Approve this review? It will be visible to all users.')) {
      return;
    }

    setProcessing(review.id);
    try {
      const response = await fetch(`/api/reviews/${review.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_type: review.review_type
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve review');
      }

      alert('Review approved successfully!');
      fetchReviews();
    } catch (error) {
      console.error('Error approving review:', error);
      alert('Failed to approve review: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDeny = async (review) => {
    const reason = prompt('Please provide a reason for denying this review:');
    if (!reason) return;

    setProcessing(review.id);
    try {
      const response = await fetch(`/api/reviews/${review.id}/deny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_type: review.review_type,
          review_notes: reason
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to deny review');
      }

      alert('Review denied successfully!');
      fetchReviews();
    } catch (error) {
      console.error('Error denying review:', error);
      alert('Failed to deny review: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (review) => {
    if (deleteConfirm !== review.id) {
      setDeleteConfirm(review.id);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      let error;
      if (review.type === 'Brand') {
        ({ error } = await supabase
          .from('brand_reviews')
          .delete()
          .eq('brand_review_id', review.id));
      } else if (review.type === 'Supplier') {
        ({ error } = await supabase
          .from('supplier_reviews')
          .delete()
          .eq('supplier_review_id', review.id));
      } else if (review.type === 'Distributor') {
        ({ error } = await supabase
          .from('distributor_reviews')
          .delete()
          .eq('distributor_review_id', review.id));
      }

      if (error) throw error;
      
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Delete error:', err.message);
      alert('Failed to delete review: ' + err.message);
    }
  };

  const columns = [
    { key: 'status', label: 'Status' },
    { key: 'type', label: 'Type' },
    { key: 'entity_name', label: 'Entity' },
    { key: 'user_name', label: 'Reviewer' },
    { key: 'rating', label: 'Rating' },
    { key: 'title', label: 'Title' },
    { key: 'content', label: 'Review' },
    { key: 'category_ratings', label: 'Category Ratings' },
    { key: 'created_at', label: 'Created' },
    { key: 'actions', label: 'Actions' },
  ];

  const filteredReviews = reviews.filter(review => {
    // Filter by type
    if (filterType !== 'all' && review.type.toLowerCase() !== filterType.toLowerCase()) {
      return false;
    }
    
    // Filter by status
    if (statusFilter !== 'all' && review.status !== statusFilter) {
      return false;
    }
    
    // Filter by search term
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      review.entity_name?.toLowerCase().includes(searchLower) ||
      review.user_name?.toLowerCase().includes(searchLower) ||
      review.title?.toLowerCase().includes(searchLower) ||
      review.content?.toLowerCase().includes(searchLower) ||
      review.type?.toLowerCase().includes(searchLower)
    );
  });

  const sortedReviews = [...filteredReviews].sort((a, b) => {
    const { key, direction } = sortConfig;
    if (!key) return 0;
    const aVal = a[key] ?? '';
    const bVal = b[key] ?? '';
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key)
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: 'asc' };
    });
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Reviews ({filteredReviews.length} of {reviews.length})</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: 14,
              background: 'white'
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">⏳ Pending</option>
            <option value="approved">✓ Approved</option>
            <option value="denied">✕ Denied</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: 14,
              background: 'white'
            }}
          >
            <option value="all">All Types</option>
            <option value="brand">Brand Reviews</option>
            <option value="supplier">Supplier Reviews</option>
            <option value="distributor">Distributor Reviews</option>
          </select>
          <SearchInput 
            placeholder="Search reviews..." 
            onSearch={setSearchTerm}
          />
        </div>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            tableLayout: 'auto',
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          <thead style={{ background: '#f1f5f9' }}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: colWidths[col.key] || (col.key === 'content' ? 300 : col.key === 'category_ratings' ? 200 : 150),
                    position: 'relative',
                    borderRight: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: '#f8fafc',
                    cursor: col.key !== 'actions' && col.key !== 'category_ratings' ? 'pointer' : 'default',
                  }}
                  onClick={() => col.key !== 'actions' && col.key !== 'category_ratings' && handleSort(col.key)}
                >
                  {col.label}
                  {sortConfig.key === col.key && (
                    <span style={{ marginLeft: 4 }}>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                  {col.key !== 'actions' && (
                    <div
                      onMouseDown={(e) => startResize(e, col.key)}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        height: '100%',
                        width: '5px',
                        cursor: 'col-resize',
                        background: 'transparent',
                      }}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedReviews.map((review) => (
              <tr key={review.id}>
                {columns.map((col) => {
                  const value = review[col.key];

                  // Status badge
                  if (col.key === 'status') {
                    const statusColors = {
                      pending: { bg: '#fef3c7', text: '#92400e', label: '⏳ Pending' },
                      approved: { bg: '#d1fae5', text: '#065f46', label: '✓ Approved' },
                      denied: { bg: '#fee2e2', text: '#991b1b', label: '✕ Denied' }
                    };
                    const style = statusColors[value] || statusColors.pending;
                    return (
                      <td key={col.key} style={cellStyle}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 12,
                          background: style.bg,
                          color: style.text,
                          fontSize: 12,
                          fontWeight: 600
                        }}>
                          {style.label}
                        </span>
                      </td>
                    );
                  }

                  // Type badge
                  if (col.key === 'type') {
                    const colors = {
                      Brand: '#3b82f6',
                      Supplier: '#10b981',
                      Distributor: '#f59e0b'
                    };
                    return (
                      <td key={col.key} style={cellStyle}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 12,
                          background: colors[value] + '20',
                          color: colors[value],
                          fontSize: 12,
                          fontWeight: 600
                        }}>
                          {value}
                        </span>
                      </td>
                    );
                  }

                  // Rating stars
                  if (col.key === 'rating') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 16 }}>{'⭐'.repeat(value || 0)}</span>
                          <span style={{ fontSize: 12, color: '#64748b' }}>({value}/5)</span>
                        </div>
                      </td>
                    );
                  }

                  // Category ratings
                  if (col.key === 'category_ratings') {
                    return (
                      <td key={col.key} style={{ ...cellStyle, whiteSpace: 'normal', maxWidth: 250 }}>
                        <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                          {Object.entries(value).map(([cat, rating]) => 
                            rating ? (
                              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span style={{ color: '#64748b' }}>{cat}:</span>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{rating}/5</span>
                              </div>
                            ) : null
                          )}
                        </div>
                      </td>
                    );
                  }

                  // Content with truncation
                  if (col.key === 'content') {
                    return (
                      <td key={col.key} style={{ ...cellStyle, maxWidth: 300 }}>
                        <div 
                          style={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={value}
                        >
                          {value || '—'}
                        </div>
                      </td>
                    );
                  }

                  // Date formatting
                  if (col.key === 'created_at') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        {value ? new Date(value).toLocaleDateString() : '—'}
                      </td>
                    );
                  }

                  // Actions
                  if (col.key === 'actions') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {review.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(review)}
                                disabled={processing === review.id}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  border: 'none',
                                  borderRadius: 4,
                                  background: processing === review.id ? '#cbd5e1' : '#10b981',
                                  color: 'white',
                                  cursor: processing === review.id ? 'not-allowed' : 'pointer',
                                  fontWeight: 500
                                }}
                              >
                                {processing === review.id ? 'Processing...' : '✓ Approve'}
                              </button>
                              <button
                                onClick={() => handleDeny(review)}
                                disabled={processing === review.id}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  border: 'none',
                                  borderRadius: 4,
                                  background: processing === review.id ? '#cbd5e1' : '#ef4444',
                                  color: 'white',
                                  cursor: processing === review.id ? 'not-allowed' : 'pointer',
                                  fontWeight: 500
                                }}
                              >
                                {processing === review.id ? 'Processing...' : '✕ Deny'}
                              </button>
                            </>
                          )}
                          {review.status === 'denied' && review.review_notes && (
                            <div 
                              style={{ 
                                fontSize: 11, 
                                color: '#64748b', 
                                fontStyle: 'italic',
                                maxWidth: 200
                              }}
                              title={review.review_notes}
                            >
                              Reason: {review.review_notes}
                            </div>
                          )}
                          <button
                            onClick={() => handleDelete(review)}
                            style={{
                              padding: '6px 12px',
                              fontSize: 12,
                              border: 'none',
                              borderRadius: 4,
                              background: deleteConfirm === review.id ? '#ef4444' : '#f87171',
                              color: 'white',
                              cursor: 'pointer',
                              fontWeight: 500
                            }}
                          >
                            {deleteConfirm === review.id ? 'Confirm?' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td key={col.key} style={cellStyle}>
                      {value || '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellStyle = {
  padding: '8px 12px',
  borderBottom: '1px solid #f1f5f9',
  whiteSpace: 'nowrap',
  maxWidth: 400,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

