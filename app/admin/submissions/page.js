'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SubmissionsDashboard() {
  const [activeTab, setActiveTab] = useState('pending');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchSubmissions(activeTab);
  }, [activeTab]);

  const fetchSubmissions = async (status) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brand_submissions')
        .select('*')
        .eq('status', status)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
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
      fetchSubmissions(activeTab);
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
      fetchSubmissions(activeTab);
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
      case 'Change': return '✏️ Change';
      case 'Orphan_Correction': return '🔗 Orphan Correction';
      default: return type;
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

  const renderSubmissionDetails = (submission) => {
    const { payload, brand_category } = submission;

    if (submission.submission_type === 'Orphan_Correction') {
      if (brand_category === 'brand_supplier') {
        return (
          <div style={{ fontSize: 14, color: '#475569' }}>
            <strong>{payload.orphaned_brand_name}</strong> → <strong>{payload.suggested_supplier_name}</strong>
          </div>
        );
      } else if (brand_category === 'supplier_distributor') {
        return (
          <div style={{ fontSize: 14, color: '#475569' }}>
            <strong>{payload.orphaned_supplier_name}</strong> → <strong>{payload.suggested_distributor_name}</strong> ({payload.suggested_state_name})
          </div>
        );
      }
    }

    return (
      <div style={{ fontSize: 14, color: '#475569' }}>
        {JSON.stringify(payload, null, 2)}
      </div>
    );
  };

  const statCounts = {
    pending: submissions.filter(s => s.status === 'pending').length,
    under_review: submissions.filter(s => s.status === 'under_review').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Submissions Dashboard</h1>
      <p style={{ color: '#64748b', marginTop: 8, marginBottom: 24 }}>
        Review and approve user-submitted additions, changes, and orphan corrections.
      </p>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid #e2e8f0', 
        marginBottom: 24,
        gap: 0
      }}>
        {[
          { key: 'pending', label: 'Pending', count: statCounts.pending },
          { key: 'under_review', label: 'Under Review', count: statCounts.under_review },
          { key: 'approved', label: 'Approved', count: statCounts.approved },
          { key: 'rejected', label: 'Rejected', count: statCounts.rejected }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 24px',
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

      {/* Submissions List */}
      {loading ? (
        <p>Loading submissions...</p>
      ) : submissions.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 14 }}>No submissions found in this category.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {submissions.map(submission => (
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
              {activeTab === 'pending' && (
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

