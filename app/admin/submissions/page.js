'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SubmissionsDashboard() {
  const [activeTab, setActiveTab] = useState('brand_update');
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [allReviews, setAllReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchAllSubmissions(), fetchAllReviews()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSubmissions = async () => {
    try {
      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(`/api/submissions/list?t=${timestamp}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }
      const data = await response.json();
      console.log('Fetched submissions:', data.length, 'total');
      setAllSubmissions(data);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      throw error;
    }
  };

  const fetchAllReviews = async () => {
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
            status,
            reviewed_at,
            reviewed_by,
            review_notes,
            brand_id,
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
            status,
            reviewed_at,
            reviewed_by,
            review_notes,
            supplier_id,
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
            status,
            reviewed_at,
            reviewed_by,
            review_notes,
            distributor_id,
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
          type: 'brand',
          review_type: 'brand',
          entity_name: r.core_brands?.brand_name || 'Unknown',
          user_name: userMap[r.user_id] || 'Unknown User',
          rating: r.rating,
          title: r.title,
          content: r.content,
          created_at: r.created_at,
          user_id: r.user_id,
          entity_id: r.brand_id,
          status: r.status || 'pending',
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
          type: 'supplier',
          review_type: 'supplier',
          entity_name: r.core_suppliers?.supplier_name || 'Unknown',
          user_name: userMap[r.user_id] || 'Unknown User',
          rating: r.rating,
          title: r.title,
          content: r.content,
          created_at: r.created_at,
          user_id: r.user_id,
          entity_id: r.supplier_id,
          status: r.status || 'pending',
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
          type: 'distributor',
          review_type: 'distributor',
          entity_name: r.core_distributors?.distributor_name || 'Unknown',
          user_name: userMap[r.user_id] || 'Unknown User',
          rating: r.rating,
          title: r.title,
          content: r.content,
          created_at: r.created_at,
          user_id: r.user_id,
          entity_id: r.distributor_id,
          status: r.status || 'pending',
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

      setAllReviews(allReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      throw error;
    }
  };

  const handleApprove = async (submissionId) => {
    if (!confirm('Approve this submission? This will create the relationship in the database.')) {
      return;
    }

    setProcessing(submissionId);
    try {
      const response = await fetch(`/api/submissions/${submissionId}/approve`, {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve submission');
      }

      alert('Submission approved successfully!');
      console.log('Approval successful, refreshing submissions...');
      await fetchAllSubmissions();
      console.log('Submissions refreshed');
    } catch (error) {
      console.error('Error approving submission:', error);
      alert('Failed to approve submission: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (submissionId) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    setProcessing(submissionId);
    try {
      const response = await fetch(`/api/submissions/${submissionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reject submission');
      }

      alert('Submission rejected successfully!');
      await fetchAllSubmissions();
    } catch (error) {
      console.error('Error rejecting submission:', error);
      alert('Failed to reject submission: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveReview = async (review) => {
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
      await fetchAllReviews();
    } catch (error) {
      console.error('Error approving review:', error);
      alert('Failed to approve review: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDenyReview = async (review) => {
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
      await fetchAllReviews();
    } catch (error) {
      console.error('Error denying review:', error);
      alert('Failed to deny review: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const getSubmissionTypeLabel = (type, category, payload) => {
    switch (type) {
      case 'Addition': return '➕ Addition';
      case 'Change': return '✏️ Update';
      case 'Orphan_Correction': return '🔗 Link';
      // Handle null submission_type for orphan corrections (lonely brands/suppliers from mobile app)
      case null:
      case undefined:
        // Check if it's an allocation submission based on payload
        if (payload?.submission_type === 'brand_allocation' || 
            payload?.user_notes?.includes('ALLOCATION_STATUS') ||
            payload?.additional_notes?.includes('ALLOCATION_STATUS')) {
          return '🎯 Allocation';
        }
        // If it's a relationship category, it's likely an orphan correction
        if (category === 'brand_supplier' || category === 'supplier_distributor') {
          return '🔗 Link';
        }
        return 'Unknown';
      default: return type || 'Unknown';
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'brand': return 'Brand';
      case 'supplier': return 'Supplier';
      case 'distributor': return 'Distributor';
      case 'brand_supplier': return 'Brand ↔ Supplier';
      case 'brand_distributor': return 'Brand ↔ Distributor';
      case 'supplier_distributor': return 'Supplier ↔ Distributor';
      default: return category;
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
      under_review: { bg: '#dbeafe', text: '#1e40af', label: 'Under Review' },
      approved: { bg: '#d1fae5', text: '#065f46', label: 'Approved' },
      rejected: { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' }
    };
    const style = colors[status] || colors.pending;
    return (
      <span style={{
        padding: '4px 10px',
        background: style.bg,
        color: style.text,
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        {style.label}
      </span>
    );
  };

  const renderReviewDetails = (review) => {
    return (
      <div style={{ fontSize: 14, color: '#475569' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <strong>Rating:</strong>
            <span style={{ fontSize: 16 }}>{'⭐'.repeat(review.rating || 0)}</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>({review.rating}/5)</span>
          </div>
        </div>
        
        {review.title && (
          <div style={{ marginBottom: 8 }}>
            <strong>Title:</strong> {review.title}
          </div>
        )}
        
        {review.content && (
          <div style={{ marginBottom: 12 }}>
            <strong>Review:</strong>
            <div style={{ marginTop: 4, padding: 8, background: 'white', borderRadius: 4 }}>
              {review.content}
            </div>
          </div>
        )}

        {review.category_ratings && (
          <div>
            <strong>Category Ratings:</strong>
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.8 }}>
              {Object.entries(review.category_ratings).map(([cat, rating]) => 
                rating ? (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: '#64748b' }}>{cat}:</span>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{rating}/5</span>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSubmissionDetails = (submission) => {
    const { payload, submission_category, submission_type } = submission;
    
    // Parse payload if it's a string
    let parsedPayload = payload;
    if (typeof payload === 'string') {
      try {
        parsedPayload = JSON.parse(payload);
      } catch (e) {
        console.error('Failed to parse payload:', e);
      }
    }

    // Orphan Corrections (Lonely updates) - handle both old and new payload structures
    if (submission_type === 'Orphan_Correction' || !submission_type) {
      if (submission_category === 'brand_supplier') {
        const brandName = parsedPayload?.brand_name || parsedPayload?.orphaned_brand_name || submission.brand_name_submitted;
        const supplierName = parsedPayload?.supplier_name || parsedPayload?.suggested_supplier_name || submission.supplier_name_submitted;
        const userNotes = parsedPayload?.user_notes || parsedPayload?.reason;
        const aiResponse = parsedPayload?.ai_response;
        const userProfile = parsedPayload?.user_profile;
        
        return (
          <div style={{ fontSize: 14, color: '#475569' }}>
            <div style={{ marginBottom: 12 }}>
              <strong>🏷️ Lonely Brand:</strong>{' '}
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>{brandName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 24, color: '#3b82f6' }}>→</span>
              <div>
                <strong>Link to Supplier:</strong>{' '}
                <span style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>{supplierName}</span>
              </div>
            </div>
            {userNotes && (
              <div style={{ 
                padding: 10, 
                background: '#fef3c7', 
                borderLeft: '3px solid #f59e0b',
                borderRadius: 4,
                marginBottom: 12
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
                  User Notes
                </div>
                <div style={{ fontSize: 13, color: '#92400e' }}>{userNotes}</div>
              </div>
            )}
            {userProfile && (
              <div style={{ 
                fontSize: 12, 
                color: '#64748b',
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid #e2e8f0'
              }}>
                <div><strong>Submitted by:</strong> {userProfile.first_name} {userProfile.last_name}</div>
                {userProfile.employer && <div><strong>Employer:</strong> {userProfile.employer}</div>}
                {userProfile.job_title && <div><strong>Role:</strong> {userProfile.job_title}</div>}
                {userProfile.location && <div><strong>Region:</strong> {userProfile.location}</div>}
              </div>
            )}
          </div>
        );
      } else if (submission_category === 'supplier_distributor') {
        return (
          <div style={{ fontSize: 14, color: '#475569' }}>
            <div style={{ marginBottom: 8 }}>
              <strong>Lonely Supplier:</strong> {payload.orphaned_supplier_name || submission.supplier_name_submitted}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>→</span>
              <strong>Link to Distributor:</strong> {payload.suggested_distributor_name || submission.distributor_name_submitted}
            </div>
            {payload.suggested_state_name && (
              <div>
                <strong>State:</strong> {payload.suggested_state_name}
              </div>
            )}
            {payload.reason && (
              <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', marginTop: 8 }}>
                Reason: {payload.reason}
              </div>
            )}
          </div>
        );
      }
    }

    // Regular additions/updates
    if (submission_category === 'brand') {
      // Check if this is an allocation submission
      const isAllocationSubmission = payload?.submission_type === 'brand_allocation' || 
                                   payload?.user_notes?.includes('ALLOCATION_STATUS') ||
                                   payload?.additional_notes?.includes('ALLOCATION_STATUS');
      
      if (isAllocationSubmission) {
        const isAllocated = payload.user_notes?.includes('ALLOCATION_STATUS:true') || 
                           payload.additional_notes?.includes('ALLOCATION_STATUS:true') ||
                           payload.ai_response?.toLowerCase().includes('allocated');
        
        return (
          <div style={{ fontSize: 14, color: '#475569' }}>
            <div style={{ marginBottom: 12 }}>
              <strong>Brand Name:</strong>{' '}
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
                {submission.brand_name_submitted || payload.brand_name}
              </span>
            </div>
            <div style={{ 
              padding: 10, 
              background: isAllocated ? '#d1fae5' : '#fef3c7', 
              borderLeft: `3px solid ${isAllocated ? '#10b981' : '#f59e0b'}`,
              borderRadius: 4,
              marginBottom: 12
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: isAllocated ? '#065f46' : '#92400e', marginBottom: 4 }}>
                Allocation Status Change
              </div>
              <div style={{ fontSize: 13, color: isAllocated ? '#065f46' : '#92400e' }}>
                {isAllocated ? '✅ Mark as Allocated' : '❌ Mark as Not Allocated'}
              </div>
            </div>
            {payload.ai_response && (
              <div style={{ 
                padding: 8, 
                background: '#f8fafc', 
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                fontSize: 12,
                color: '#64748b',
                fontStyle: 'italic'
              }}>
                AI Response: {payload.ai_response}
              </div>
            )}
          </div>
        );
      }
      
      return (
        <div style={{ fontSize: 14, color: '#475569' }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Brand Name:</strong> {submission.brand_name_submitted || payload.brand_name}
          </div>
          {payload.brand_url && (
            <div style={{ marginBottom: 8 }}>
              <strong>Website:</strong> <a href={payload.brand_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{payload.brand_url}</a>
            </div>
          )}
          {payload.category && (
            <div>
              <strong>Category:</strong> {payload.category}
            </div>
          )}
        </div>
      );
    } else if (submission_category === 'supplier') {
      return (
        <div style={{ fontSize: 14, color: '#475569' }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Supplier Name:</strong> {submission.supplier_name_submitted || payload.supplier_name}
          </div>
          {payload.supplier_url && (
            <div>
              <strong>Website:</strong> <a href={payload.supplier_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{payload.supplier_url}</a>
            </div>
          )}
        </div>
      );
    } else if (submission_category === 'distributor') {
      return (
        <div style={{ fontSize: 14, color: '#475569' }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Distributor Name:</strong> {submission.distributor_name_submitted || payload.distributor_name}
          </div>
          {payload.distributor_url && (
            <div>
              <strong>Website:</strong> <a href={payload.distributor_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{payload.distributor_url}</a>
            </div>
          )}
        </div>
      );
    }

    // Fallback: show JSON
    return (
      <pre style={{ fontSize: 12, color: '#475569', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
        {JSON.stringify(payload, null, 2)}
      </pre>
    );
  };

  // Filter submissions and reviews by tab
  const getFilteredItems = () => {
    const pendingSubmissions = allSubmissions.filter(s => s.status === 'pending');
    const pendingReviews = allReviews.filter(r => r.status === 'pending');
    
    switch (activeTab) {
      case 'brand_update':
        return pendingSubmissions.filter(s => s.submission_type === 'Change' && s.submission_category === 'brand');
      case 'brand_addition':
        return pendingSubmissions.filter(s => s.submission_type === 'Addition' && s.submission_category === 'brand');
      case 'brand_allocation':
        return pendingSubmissions.filter(s => {
          const payload = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload;
          return s.submission_category === 'brand' && (
            payload?.submission_type === 'brand_allocation' || 
            payload?.user_notes?.includes('ALLOCATION_STATUS') ||
            payload?.additional_notes?.includes('ALLOCATION_STATUS') ||
            s.additional_notes?.includes('ALLOCATION_STATUS')
          );
        });
      case 'supplier_addition':
        return pendingSubmissions.filter(s => s.submission_type === 'Addition' && s.submission_category === 'supplier');
      case 'distributor_addition':
        return pendingSubmissions.filter(s => s.submission_type === 'Addition' && s.submission_category === 'distributor');
      case 'lonely_brand':
        // Handle both explicit Orphan_Correction and NULL/missing submission_type for brand_supplier category
        return pendingSubmissions.filter(s => (s.submission_type === 'Orphan_Correction' || !s.submission_type) && s.submission_category === 'brand_supplier');
      case 'lonely_supplier':
        // Handle both explicit Orphan_Correction and NULL/missing submission_type for supplier_distributor category
        return pendingSubmissions.filter(s => (s.submission_type === 'Orphan_Correction' || !s.submission_type) && s.submission_category === 'supplier_distributor');
      case 'brand_reviews':
        return pendingReviews.filter(r => r.type === 'brand');
      case 'supplier_reviews':
        return pendingReviews.filter(r => r.type === 'supplier');
      case 'distributor_reviews':
        return pendingReviews.filter(r => r.type === 'distributor');
      case 'approved_submissions':
        return allSubmissions.filter(s => s.status === 'approved');
      case 'rejected_submissions':
        return allSubmissions.filter(s => s.status === 'rejected');
      case 'approved_reviews':
        return allReviews.filter(r => r.status === 'approved');
      case 'denied_reviews':
        return allReviews.filter(r => r.status === 'denied');
      default:
        return [];
    }
  };

  const filteredItems = getFilteredItems();
  const isReviewTab = ['brand_reviews', 'supplier_reviews', 'distributor_reviews', 'approved_reviews', 'denied_reviews'].includes(activeTab);

  // Calculate counts for all tabs
  const pendingSubmissions = allSubmissions.filter(s => s.status === 'pending');
  const pendingReviews = allReviews.filter(r => r.status === 'pending');
  const tabCounts = {
    brand_update: pendingSubmissions.filter(s => s.submission_type === 'Change' && s.submission_category === 'brand').length,
    brand_addition: pendingSubmissions.filter(s => s.submission_type === 'Addition' && s.submission_category === 'brand').length,
    brand_allocation: pendingSubmissions.filter(s => {
      const payload = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload;
      return s.submission_category === 'brand' && (
        payload?.submission_type === 'brand_allocation' || 
        payload?.user_notes?.includes('ALLOCATION_STATUS') ||
        payload?.additional_notes?.includes('ALLOCATION_STATUS') ||
        s.additional_notes?.includes('ALLOCATION_STATUS')
      );
    }).length,
    supplier_addition: pendingSubmissions.filter(s => s.submission_type === 'Addition' && s.submission_category === 'supplier').length,
    distributor_addition: pendingSubmissions.filter(s => s.submission_type === 'Addition' && s.submission_category === 'distributor').length,
    lonely_brand: pendingSubmissions.filter(s => (s.submission_type === 'Orphan_Correction' || !s.submission_type) && s.submission_category === 'brand_supplier').length,
    lonely_supplier: pendingSubmissions.filter(s => (s.submission_type === 'Orphan_Correction' || !s.submission_type) && s.submission_category === 'supplier_distributor').length,
    brand_reviews: pendingReviews.filter(r => r.type === 'brand').length,
    supplier_reviews: pendingReviews.filter(r => r.type === 'supplier').length,
    distributor_reviews: pendingReviews.filter(r => r.type === 'distributor').length,
    approved_submissions: allSubmissions.filter(s => s.status === 'approved').length,
    rejected_submissions: allSubmissions.filter(s => s.status === 'rejected').length,
    approved_reviews: allReviews.filter(r => r.status === 'approved').length,
    denied_reviews: allReviews.filter(r => r.status === 'denied').length
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Submissions Dashboard</h1>
      <p style={{ color: '#64748b', marginTop: 8, marginBottom: 24 }}>
        Review and approve user-submitted additions, updates, and orphan corrections.
      </p>

      {/* Tabs */}
      <div style={{ marginBottom: 24 }}>
        {/* Standard Submissions Section */}
        <div style={{ 
          fontSize: 20, 
          fontWeight: 700, 
          color: '#1e293b', 
          marginBottom: 16,
          marginTop: 32,
          paddingBottom: 8,
          borderBottom: '3px solid #3b82f6'
        }}>
          📋 Standard Submissions
        </div>
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #e2e8f0', 
          marginBottom: 12,
          gap: 0,
          flexWrap: 'wrap'
        }}>
          {[
            { key: 'brand_update', label: '✏️ Brand Update', count: tabCounts.brand_update },
            { key: 'brand_addition', label: '➕ Brand Addition', count: tabCounts.brand_addition },
            { key: 'brand_allocation', label: '🎯 Brand Allocation', count: tabCounts.brand_allocation },
            { key: 'supplier_addition', label: '➕ Supplier Addition', count: tabCounts.supplier_addition },
            { key: 'distributor_addition', label: '➕ Distributor Addition', count: tabCounts.distributor_addition }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px',
                background: activeTab === tab.key ? 'white' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === tab.key ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Show submissions for Standard Submissions tabs */}
        {['brand_update', 'brand_addition', 'brand_allocation', 'supplier_addition', 'distributor_addition'].includes(activeTab) && (
          <div style={{ marginTop: 24 }}>
            {loading ? (
              <p>Loading...</p>
            ) : filteredItems.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 14 }}>No items found in this category.</p>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {filteredItems.map(item => {
                  const isReview = item.review_type !== undefined;
                  const itemId = isReview ? item.id : item.submission_id;
                  
                  return (
                  <div
                    key={itemId}
                    style={{
                      padding: 20,
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      display: 'grid',
                      gap: 12
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          {isReview ? (
                            <>
                              <span style={{ 
                                fontSize: 13,
                                fontWeight: 600,
                                padding: '2px 8px',
                                background: '#ede9fe',
                                color: '#7c3aed',
                                borderRadius: 4
                              }}>
                                ⭐ Review
                              </span>
                              <span style={{ 
                                fontSize: 13,
                                padding: '2px 8px',
                                background: '#f3f4f6',
                                color: '#374151',
                                borderRadius: 4
                              }}>
                                {item.entity_name}
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={{ 
                                fontSize: 13,
                                fontWeight: 600,
                                padding: '2px 8px',
                                background: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: 4
                              }}>
                                {getSubmissionTypeLabel(item.submission_type, item.submission_category, item.payload)}
                              </span>
                              <span style={{ 
                                fontSize: 13,
                                padding: '2px 8px',
                                background: '#f3f4f6',
                                color: '#374151',
                                borderRadius: 4
                              }}>
                                {getCategoryLabel(item.submission_category)}
                              </span>
                            </>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          {isReview ? `Submitted ${new Date(item.created_at).toLocaleString()}` : `Submitted ${new Date(item.submitted_at).toLocaleString()}`}
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(item.status)}
                      </div>
                    </div>

                    {/* Details */}
                    <div style={{ 
                      padding: 12, 
                      background: '#f8fafc', 
                      borderRadius: 6,
                      border: '1px solid #e2e8f0'
                    }}>
                      {isReview ? renderReviewDetails(item) : renderSubmissionDetails(item)}
                    </div>

                    {/* Additional Notes / User Info for Reviews */}
                    {isReview && (
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        Submitted by: {item.user_name}
                      </div>
                    )}

                    {/* Additional Notes for Submissions - only show if not already shown in details */}
                    {!isReview && item.additional_notes && !item.payload?.user_notes && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notes:</div>
                        <div style={{ fontSize: 14, color: '#64748b' }}>{item.additional_notes}</div>
                      </div>
                    )}

                    {/* User Info for Submissions - only show if not already shown in details */}
                    {!isReview && (item.user_email || item.user_first_name) && !item.payload?.user_profile && (
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        Submitted by: {item.user_first_name} {item.user_last_name} {item.user_email && `(${item.user_email})`}
                      </div>
                    )}

                    {/* Rejection/Denial Reason */}
                    {((item.status === 'rejected' && item.rejection_reason) || (item.status === 'denied' && item.review_notes)) && (
                      <div style={{ 
                        padding: 12,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 6
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>
                          {item.status === 'rejected' ? 'Rejection Reason:' : 'Denial Reason:'}
                        </div>
                        <div style={{ fontSize: 14, color: '#991b1b' }}>{item.rejection_reason || item.review_notes}</div>
                      </div>
                    )}

                    {/* Actions (only for pending) */}
                    {item.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => isReview ? handleApproveReview(item) : handleApprove(itemId)}
                          disabled={processing === itemId}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'white',
                            background: processing === itemId ? '#cbd5e1' : '#10b981',
                            border: 'none',
                            borderRadius: 6,
                            cursor: processing === itemId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {processing === itemId ? 'Processing...' : '✓ Approve'}
                        </button>
                        <button
                          onClick={() => isReview ? handleDenyReview(item) : handleReject(itemId)}
                          disabled={processing === itemId}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'white',
                            background: processing === itemId ? '#cbd5e1' : '#ef4444',
                            border: 'none',
                            borderRadius: 6,
                            cursor: processing === itemId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {processing === itemId ? 'Processing...' : isReview ? '✕ Deny' : '✕ Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        )}

        {/* Orphan Corrections Section */}
        <div style={{ 
          fontSize: 20, 
          fontWeight: 700, 
          color: '#1e293b', 
          marginBottom: 16,
          marginTop: 48,
          paddingBottom: 8,
          borderBottom: '3px solid #f59e0b'
        }}>
          🔗 Orphan Corrections (Lonely Records)
        </div>
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #e2e8f0', 
          marginBottom: 12,
          gap: 0,
          flexWrap: 'wrap'
        }}>
          {[
            { key: 'lonely_brand', label: '🔗 Lonely Brand', count: tabCounts.lonely_brand },
            { key: 'lonely_supplier', label: '🔗 Lonely Supplier', count: tabCounts.lonely_supplier }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px',
                background: activeTab === tab.key ? 'white' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #f59e0b' : '2px solid transparent',
                color: activeTab === tab.key ? '#f59e0b' : '#64748b',
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Show submissions for Orphan Corrections tabs */}
        {['lonely_brand', 'lonely_supplier'].includes(activeTab) && (
          <div style={{ marginTop: 24 }}>
            {loading ? (
              <p>Loading...</p>
            ) : filteredItems.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 14 }}>No items found in this category.</p>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {filteredItems.map(item => {
                  const isReview = item.review_type !== undefined;
                  const itemId = isReview ? item.id : item.submission_id;
                  
                  return (
                  <div
                    key={itemId}
                    style={{
                      padding: 20,
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      display: 'grid',
                      gap: 12
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          {isReview ? (
                            <>
                              <span style={{ 
                                fontSize: 13,
                                fontWeight: 600,
                                padding: '2px 8px',
                                background: '#ede9fe',
                                color: '#7c3aed',
                                borderRadius: 4
                              }}>
                                ⭐ Review
                              </span>
                              <span style={{ 
                                fontSize: 13,
                                padding: '2px 8px',
                                background: '#f3f4f6',
                                color: '#374151',
                                borderRadius: 4
                              }}>
                                {item.entity_name}
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={{ 
                                fontSize: 13,
                                fontWeight: 600,
                                padding: '2px 8px',
                                background: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: 4
                              }}>
                                {getSubmissionTypeLabel(item.submission_type, item.submission_category, item.payload)}
                              </span>
                              <span style={{ 
                                fontSize: 13,
                                padding: '2px 8px',
                                background: '#f3f4f6',
                                color: '#374151',
                                borderRadius: 4
                              }}>
                                {getCategoryLabel(item.submission_category)}
                              </span>
                            </>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          {isReview ? `Submitted ${new Date(item.created_at).toLocaleString()}` : `Submitted ${new Date(item.submitted_at).toLocaleString()}`}
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(item.status)}
                      </div>
                    </div>

                    {/* Details */}
                    <div style={{ 
                      padding: 12, 
                      background: '#f8fafc', 
                      borderRadius: 6,
                      border: '1px solid #e2e8f0'
                    }}>
                      {isReview ? renderReviewDetails(item) : renderSubmissionDetails(item)}
                    </div>

                    {/* Additional Notes / User Info for Reviews */}
                    {isReview && (
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        Submitted by: {item.user_name}
                      </div>
                    )}

                    {/* Additional Notes for Submissions - only show if not already shown in details */}
                    {!isReview && item.additional_notes && !item.payload?.user_notes && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notes:</div>
                        <div style={{ fontSize: 14, color: '#64748b' }}>{item.additional_notes}</div>
                      </div>
                    )}

                    {/* User Info for Submissions - only show if not already shown in details */}
                    {!isReview && (item.user_email || item.user_first_name) && !item.payload?.user_profile && (
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        Submitted by: {item.user_first_name} {item.user_last_name} {item.user_email && `(${item.user_email})`}
                      </div>
                    )}

                    {/* Rejection/Denial Reason */}
                    {((item.status === 'rejected' && item.rejection_reason) || (item.status === 'denied' && item.review_notes)) && (
                      <div style={{ 
                        padding: 12,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 6
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>
                          {item.status === 'rejected' ? 'Rejection Reason:' : 'Denial Reason:'}
                        </div>
                        <div style={{ fontSize: 14, color: '#991b1b' }}>{item.rejection_reason || item.review_notes}</div>
                      </div>
                    )}

                    {/* Actions (only for pending) */}
                    {item.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => isReview ? handleApproveReview(item) : handleApprove(itemId)}
                          disabled={processing === itemId}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'white',
                            background: processing === itemId ? '#cbd5e1' : '#10b981',
                            border: 'none',
                            borderRadius: 6,
                            cursor: processing === itemId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {processing === itemId ? 'Processing...' : '✓ Approve'}
                        </button>
                        <button
                          onClick={() => isReview ? handleDenyReview(item) : handleReject(itemId)}
                          disabled={processing === itemId}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'white',
                            background: processing === itemId ? '#cbd5e1' : '#ef4444',
                            border: 'none',
                            borderRadius: 6,
                            cursor: processing === itemId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {processing === itemId ? 'Processing...' : isReview ? '✕ Deny' : '✕ Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        )}

        {/* User Reviews Section */}
        <div style={{ 
          fontSize: 20, 
          fontWeight: 700, 
          color: '#1e293b', 
          marginBottom: 16,
          marginTop: 48,
          paddingBottom: 8,
          borderBottom: '3px solid #8b5cf6'
        }}>
          ⭐ User Reviews
        </div>
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #e2e8f0', 
          marginBottom: 12,
          gap: 0,
          flexWrap: 'wrap'
        }}>
          {[
            { key: 'brand_reviews', label: '⭐ Brand Reviews', count: tabCounts.brand_reviews },
            { key: 'supplier_reviews', label: '⭐ Supplier Reviews', count: tabCounts.supplier_reviews },
            { key: 'distributor_reviews', label: '⭐ Distributor Reviews', count: tabCounts.distributor_reviews }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px',
                background: activeTab === tab.key ? 'white' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #8b5cf6' : '2px solid transparent',
                color: activeTab === tab.key ? '#8b5cf6' : '#64748b',
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Show submissions for User Reviews tabs */}
        {['brand_reviews', 'supplier_reviews', 'distributor_reviews'].includes(activeTab) && (
          <div style={{ marginTop: 24 }}>
            {loading ? (
              <p>Loading...</p>
            ) : filteredItems.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 14 }}>No items found in this category.</p>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {filteredItems.map(item => {
                  const isReview = item.review_type !== undefined;
                  const itemId = isReview ? item.id : item.submission_id;
                  
                  return (
                  <div
                    key={itemId}
                    style={{
                      padding: 20,
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      display: 'grid',
                      gap: 12
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          {isReview ? (
                            <>
                              <span style={{ 
                                fontSize: 13,
                                fontWeight: 600,
                                padding: '2px 8px',
                                background: '#ede9fe',
                                color: '#7c3aed',
                                borderRadius: 4
                              }}>
                                ⭐ Review
                              </span>
                              <span style={{ 
                                fontSize: 13,
                                padding: '2px 8px',
                                background: '#f3f4f6',
                                color: '#374151',
                                borderRadius: 4
                              }}>
                                {item.entity_name}
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={{ 
                                fontSize: 13,
                                fontWeight: 600,
                                padding: '2px 8px',
                                background: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: 4
                              }}>
                                {getSubmissionTypeLabel(item.submission_type, item.submission_category, item.payload)}
                              </span>
                              <span style={{ 
                                fontSize: 13,
                                padding: '2px 8px',
                                background: '#f3f4f6',
                                color: '#374151',
                                borderRadius: 4
                              }}>
                                {getCategoryLabel(item.submission_category)}
                              </span>
                            </>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          {isReview ? `Submitted ${new Date(item.created_at).toLocaleString()}` : `Submitted ${new Date(item.submitted_at).toLocaleString()}`}
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(item.status)}
                      </div>
                    </div>

                    {/* Details */}
                    <div style={{ 
                      padding: 12, 
                      background: '#f8fafc', 
                      borderRadius: 6,
                      border: '1px solid #e2e8f0'
                    }}>
                      {isReview ? renderReviewDetails(item) : renderSubmissionDetails(item)}
                    </div>

                    {/* Additional Notes / User Info for Reviews */}
                    {isReview && (
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        Submitted by: {item.user_name}
                      </div>
                    )}

                    {/* Additional Notes for Submissions - only show if not already shown in details */}
                    {!isReview && item.additional_notes && !item.payload?.user_notes && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notes:</div>
                        <div style={{ fontSize: 14, color: '#64748b' }}>{item.additional_notes}</div>
                      </div>
                    )}

                    {/* User Info for Submissions - only show if not already shown in details */}
                    {!isReview && (item.user_email || item.user_first_name) && !item.payload?.user_profile && (
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        Submitted by: {item.user_first_name} {item.user_last_name} {item.user_email && `(${item.user_email})`}
                      </div>
                    )}

                    {/* Rejection/Denial Reason */}
                    {((item.status === 'rejected' && item.rejection_reason) || (item.status === 'denied' && item.review_notes)) && (
                      <div style={{ 
                        padding: 12,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 6
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>
                          {item.status === 'rejected' ? 'Rejection Reason:' : 'Denial Reason:'}
                        </div>
                        <div style={{ fontSize: 14, color: '#991b1b' }}>{item.rejection_reason || item.review_notes}</div>
                      </div>
                    )}

                    {/* Actions (only for pending) */}
                    {item.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => isReview ? handleApproveReview(item) : handleApprove(itemId)}
                          disabled={processing === itemId}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'white',
                            background: processing === itemId ? '#cbd5e1' : '#10b981',
                            border: 'none',
                            borderRadius: 6,
                            cursor: processing === itemId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {processing === itemId ? 'Processing...' : '✓ Approve'}
                        </button>
                        <button
                          onClick={() => isReview ? handleDenyReview(item) : handleReject(itemId)}
                          disabled={processing === itemId}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'white',
                            background: processing === itemId ? '#cbd5e1' : '#ef4444',
                            border: 'none',
                            borderRadius: 6,
                            cursor: processing === itemId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {processing === itemId ? 'Processing...' : isReview ? '✕ Deny' : '✕ Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        )}

        {/* History Section */}
        <div style={{ 
          fontSize: 20, 
          fontWeight: 700, 
          color: '#1e293b', 
          marginBottom: 16,
          marginTop: 48,
          paddingBottom: 8,
          borderBottom: '3px solid #64748b'
        }}>
          📜 History
        </div>
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #e2e8f0', 
          gap: 0,
          flexWrap: 'wrap'
        }}>
          {[
            { key: 'approved_submissions', label: '✓ Approved Submissions', count: tabCounts.approved_submissions },
            { key: 'rejected_submissions', label: '✕ Rejected Submissions', count: tabCounts.rejected_submissions },
            { key: 'approved_reviews', label: '✓ Approved Reviews', count: tabCounts.approved_reviews },
            { key: 'denied_reviews', label: '✕ Denied Reviews', count: tabCounts.denied_reviews }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px',
                background: activeTab === tab.key ? 'white' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #64748b' : '2px solid transparent',
                color: activeTab === tab.key ? '#64748b' : '#94a3b8',
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Show submissions for History tabs */}
        {['approved_submissions', 'rejected_submissions', 'approved_reviews', 'denied_reviews'].includes(activeTab) && (
          <div style={{ marginTop: 24 }}>
            {loading ? (
              <p>Loading...</p>
            ) : filteredItems.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 14 }}>No items found in this category.</p>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {filteredItems.map(item => {
                  const isReview = item.review_type !== undefined;
                  const itemId = isReview ? item.id : item.submission_id;
                  
                  return (
                  <div
                    key={itemId}
                    style={{
                      padding: 20,
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      display: 'grid',
                      gap: 12
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          {isReview ? (
                            <>
                              <span style={{ 
                                fontSize: 13,
                                fontWeight: 600,
                                padding: '2px 8px',
                                background: '#ede9fe',
                                color: '#7c3aed',
                                borderRadius: 4
                              }}>
                                ⭐ Review
                              </span>
                              <span style={{ 
                                fontSize: 13,
                                padding: '2px 8px',
                                background: '#f3f4f6',
                                color: '#374151',
                                borderRadius: 4
                              }}>
                                {item.entity_name}
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={{ 
                                fontSize: 13,
                                fontWeight: 600,
                                padding: '2px 8px',
                                background: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: 4
                              }}>
                                {getSubmissionTypeLabel(item.submission_type, item.submission_category, item.payload)}
                              </span>
                              <span style={{ 
                                fontSize: 13,
                                padding: '2px 8px',
                                background: '#f3f4f6',
                                color: '#374151',
                                borderRadius: 4
                              }}>
                                {getCategoryLabel(item.submission_category)}
                              </span>
                            </>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          {isReview ? `Submitted ${new Date(item.created_at).toLocaleString()}` : `Submitted ${new Date(item.submitted_at).toLocaleString()}`}
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(item.status)}
                      </div>
                    </div>

                    {/* Details */}
                    <div style={{ 
                      padding: 12, 
                      background: '#f8fafc', 
                      borderRadius: 6,
                      border: '1px solid #e2e8f0'
                    }}>
                      {isReview ? renderReviewDetails(item) : renderSubmissionDetails(item)}
                    </div>

                    {/* Additional Notes / User Info for Reviews */}
                    {isReview && (
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        Submitted by: {item.user_name}
                      </div>
                    )}

                    {/* Additional Notes for Submissions - only show if not already shown in details */}
                    {!isReview && item.additional_notes && !item.payload?.user_notes && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notes:</div>
                        <div style={{ fontSize: 14, color: '#64748b' }}>{item.additional_notes}</div>
                      </div>
                    )}

                    {/* User Info for Submissions - only show if not already shown in details */}
                    {!isReview && (item.user_email || item.user_first_name) && !item.payload?.user_profile && (
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        Submitted by: {item.user_first_name} {item.user_last_name} {item.user_email && `(${item.user_email})`}
                      </div>
                    )}

                    {/* Rejection/Denial Reason */}
                    {((item.status === 'rejected' && item.rejection_reason) || (item.status === 'denied' && item.review_notes)) && (
                      <div style={{ 
                        padding: 12,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 6
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>
                          {item.status === 'rejected' ? 'Rejection Reason:' : 'Denial Reason:'}
                        </div>
                        <div style={{ fontSize: 14, color: '#991b1b' }}>{item.rejection_reason || item.review_notes}</div>
                      </div>
                    )}

                    {/* Actions (only for pending) */}
                    {item.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => isReview ? handleApproveReview(item) : handleApprove(itemId)}
                          disabled={processing === itemId}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'white',
                            background: processing === itemId ? '#cbd5e1' : '#10b981',
                            border: 'none',
                            borderRadius: 6,
                            cursor: processing === itemId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {processing === itemId ? 'Processing...' : '✓ Approve'}
                        </button>
                        <button
                          onClick={() => isReview ? handleDenyReview(item) : handleReject(itemId)}
                          disabled={processing === itemId}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'white',
                            background: processing === itemId ? '#cbd5e1' : '#ef4444',
                            border: 'none',
                            borderRadius: 6,
                            cursor: processing === itemId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {processing === itemId ? 'Processing...' : isReview ? '✕ Deny' : '✕ Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
