'use client';
import { useState, useEffect } from 'react';

export default function SubmissionsDashboard() {
  const [activeTab, setActiveTab] = useState('brand_update');
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchAllSubmissions();
  }, []);

  const fetchAllSubmissions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/submissions/list');
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }
      const data = await response.json();
      setAllSubmissions(data);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      alert('Failed to load submissions: ' + error.message);
    } finally {
      setLoading(false);
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
      fetchAllSubmissions();
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
      fetchAllSubmissions();
    } catch (error) {
      console.error('Error rejecting submission:', error);
      alert('Failed to reject submission: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const getSubmissionTypeLabel = (type) => {
    switch (type) {
      case 'Addition': return '➕ Addition';
      case 'Change': return '✏️ Update';
      case 'Orphan_Correction': return '🔗 Link';
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

  const renderSubmissionDetails = (submission) => {
    const { payload, brand_category, submission_type } = submission;

    // Orphan Corrections (Lonely updates)
    if (submission_type === 'Orphan_Correction') {
      if (brand_category === 'brand_supplier') {
        return (
          <div style={{ fontSize: 14, color: '#475569' }}>
            <div style={{ marginBottom: 8 }}>
              <strong>Lonely Brand:</strong> {payload.orphaned_brand_name || submission.brand_name_submitted}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>→</span>
              <strong>Link to Supplier:</strong> {payload.suggested_supplier_name || submission.supplier_name_submitted}
            </div>
            {payload.reason && (
              <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                Reason: {payload.reason}
              </div>
            )}
          </div>
        );
      } else if (brand_category === 'supplier_distributor') {
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
    if (brand_category === 'brand') {
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
    } else if (brand_category === 'supplier') {
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
    } else if (brand_category === 'distributor') {
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

  // Filter submissions by tab
  const getFilteredSubmissions = () => {
    const pending = allSubmissions.filter(s => s.status === 'pending');
    
    switch (activeTab) {
      case 'brand_update':
        return pending.filter(s => s.submission_type === 'Change' && s.brand_category === 'brand');
      case 'brand_addition':
        return pending.filter(s => s.submission_type === 'Addition' && s.brand_category === 'brand');
      case 'supplier_addition':
        return pending.filter(s => s.submission_type === 'Addition' && s.brand_category === 'supplier');
      case 'distributor_addition':
        return pending.filter(s => s.submission_type === 'Addition' && s.brand_category === 'distributor');
      case 'lonely_brand':
        // Handle both explicit Orphan_Correction and NULL/missing submission_type for brand_supplier category
        return pending.filter(s => (s.submission_type === 'Orphan_Correction' || !s.submission_type) && s.brand_category === 'brand_supplier');
      case 'lonely_supplier':
        // Handle both explicit Orphan_Correction and NULL/missing submission_type for supplier_distributor category
        return pending.filter(s => (s.submission_type === 'Orphan_Correction' || !s.submission_type) && s.brand_category === 'supplier_distributor');
      case 'approved':
        return allSubmissions.filter(s => s.status === 'approved');
      case 'rejected':
        return allSubmissions.filter(s => s.status === 'rejected');
      default:
        return [];
    }
  };

  const filteredSubmissions = getFilteredSubmissions();

  // Calculate counts for all tabs
  const pendingSubmissions = allSubmissions.filter(s => s.status === 'pending');
  const tabCounts = {
    brand_update: pendingSubmissions.filter(s => s.submission_type === 'Change' && s.brand_category === 'brand').length,
    brand_addition: pendingSubmissions.filter(s => s.submission_type === 'Addition' && s.brand_category === 'brand').length,
    supplier_addition: pendingSubmissions.filter(s => s.submission_type === 'Addition' && s.brand_category === 'supplier').length,
    distributor_addition: pendingSubmissions.filter(s => s.submission_type === 'Addition' && s.brand_category === 'distributor').length,
    lonely_brand: pendingSubmissions.filter(s => (s.submission_type === 'Orphan_Correction' || !s.submission_type) && s.brand_category === 'brand_supplier').length,
    lonely_supplier: pendingSubmissions.filter(s => (s.submission_type === 'Orphan_Correction' || !s.submission_type) && s.brand_category === 'supplier_distributor').length,
    approved: allSubmissions.filter(s => s.status === 'approved').length,
    rejected: allSubmissions.filter(s => s.status === 'rejected').length
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Submissions Dashboard</h1>
      <p style={{ color: '#64748b', marginTop: 8, marginBottom: 24 }}>
        Review and approve user-submitted additions, updates, and orphan corrections.
      </p>

      {/* Tabs */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 12, textTransform: 'uppercase' }}>
          Standard Submissions
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

        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 12, marginTop: 24, textTransform: 'uppercase' }}>
          Orphan Corrections (Lonely Records)
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

        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 12, marginTop: 24, textTransform: 'uppercase' }}>
          History
        </div>
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #e2e8f0', 
          gap: 0,
          flexWrap: 'wrap'
        }}>
          {[
            { key: 'approved', label: '✓ Approved', count: tabCounts.approved },
            { key: 'rejected', label: '✕ Rejected', count: tabCounts.rejected }
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
      </div>

      {/* Submissions List */}
      {loading ? (
        <p>Loading submissions...</p>
      ) : filteredSubmissions.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 14 }}>No submissions found in this category.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {filteredSubmissions.map(submission => (
            <div
              key={submission.brand_submission_id}
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
                    <span style={{ 
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '2px 8px',
                      background: '#dbeafe',
                      color: '#1e40af',
                      borderRadius: 4
                    }}>
                      {getSubmissionTypeLabel(submission.submission_type)}
                    </span>
                    <span style={{ 
                      fontSize: 13,
                      padding: '2px 8px',
                      background: '#f3f4f6',
                      color: '#374151',
                      borderRadius: 4
                    }}>
                      {getCategoryLabel(submission.brand_category)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Submitted {new Date(submission.submitted_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  {getStatusBadge(submission.status)}
                </div>
              </div>

              {/* Details */}
              <div style={{ 
                padding: 12, 
                background: '#f8fafc', 
                borderRadius: 6,
                border: '1px solid #e2e8f0'
              }}>
                {renderSubmissionDetails(submission)}
              </div>

              {/* Additional Notes */}
              {submission.additional_notes && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notes:</div>
                  <div style={{ fontSize: 14, color: '#64748b' }}>{submission.additional_notes}</div>
                </div>
              )}

              {/* User Info */}
              {(submission.user_email || submission.user_first_name) && (
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Submitted by: {submission.user_first_name} {submission.user_last_name} {submission.user_email && `(${submission.user_email})`}
                </div>
              )}

              {/* Rejection Reason (if rejected) */}
              {submission.status === 'rejected' && submission.rejection_reason && (
                <div style={{ 
                  padding: 12,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>
                    Rejection Reason:
                  </div>
                  <div style={{ fontSize: 14, color: '#991b1b' }}>{submission.rejection_reason}</div>
                </div>
              )}

              {/* Actions (only for pending) */}
              {submission.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => handleApprove(submission.brand_submission_id)}
                    disabled={processing === submission.brand_submission_id}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'white',
                      background: processing === submission.brand_submission_id ? '#cbd5e1' : '#10b981',
                      border: 'none',
                      borderRadius: 6,
                      cursor: processing === submission.brand_submission_id ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {processing === submission.brand_submission_id ? 'Processing...' : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(submission.brand_submission_id)}
                    disabled={processing === submission.brand_submission_id}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'white',
                      background: processing === submission.brand_submission_id ? '#cbd5e1' : '#ef4444',
                      border: 'none',
                      borderRadius: 6,
                      cursor: processing === submission.brand_submission_id ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {processing === submission.brand_submission_id ? 'Processing...' : '✕ Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
