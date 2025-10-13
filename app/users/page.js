'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import SearchInput from '@/components/SearchInput';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colWidths, setColWidths] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('userColWidths');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      // Fetch user profiles with auth user info
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // Get submission counts for each user
      const { data: submissions, error: submissionError } = await supabase
        .from('user_submissions')
        .select('submitted_by');

      if (submissionError) throw submissionError;

      // Count submissions per user
      const submissionCounts = {};
      submissions?.forEach(sub => {
        submissionCounts[sub.submitted_by] = (submissionCounts[sub.submitted_by] || 0) + 1;
      });

      // Get review counts for each user
      const [brandReviews, supplierReviews, distributorReviews] = await Promise.all([
        supabase.from('brand_reviews').select('user_id'),
        supabase.from('supplier_reviews').select('user_id'),
        supabase.from('distributor_reviews').select('user_id')
      ]);

      const reviewCounts = {};
      [...(brandReviews.data || []), ...(supplierReviews.data || []), ...(distributorReviews.data || [])].forEach(review => {
        reviewCounts[review.user_id] = (reviewCounts[review.user_id] || 0) + 1;
      });

      // Combine all data
      const enrichedUsers = profiles.map(profile => ({
        ...profile,
        submission_count: submissionCounts[profile.user_id] || 0,
        review_count: reviewCounts[profile.user_id] || 0
      }));

      setUsers(enrichedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
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
        localStorage.setItem('userColWidths', JSON.stringify(updated));
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


  const handleDelete = async (userId) => {
    if (deleteConfirm !== userId) {
      setDeleteConfirm(userId);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      // Note: This will only delete the profile, not the auth user
      // For full deletion, you'd need to use Supabase admin API
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      setDeleteConfirm(null);
      alert('User profile deleted successfully');
    } catch (err) {
      console.error('Delete error:', err.message);
      alert('Failed to delete user: ' + err.message);
    }
  };

  const columns = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'job_title', label: 'Job Title' },
    { key: 'employer', label: 'Employer' },
    { key: 'location', label: 'Location' },
    { key: 'submission_count', label: 'Submissions' },
    { key: 'review_count', label: 'Reviews' },
    { key: 'created_at', label: 'Joined' },
    { key: 'actions', label: 'Actions' },
  ];

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.job_title?.toLowerCase().includes(searchLower) ||
      user.employer?.toLowerCase().includes(searchLower) ||
      user.location?.toLowerCase().includes(searchLower)
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
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
        <h1>Users ({filteredUsers.length} of {users.length})</h1>
        <SearchInput 
          placeholder="Search users..." 
          onSearch={setSearchTerm}
        />
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
                    width: colWidths[col.key] || 150,
                    position: 'relative',
                    borderRight: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: '#f8fafc',
                    cursor: col.key !== 'actions' ? 'pointer' : 'default',
                  }}
                  onClick={() => col.key !== 'actions' && handleSort(col.key)}
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
            {sortedUsers.map((user) => (
              <tr key={user.user_id}>
                {columns.map((col) => {
                  const value = user[col.key];

                  // Actions column
                  if (col.key === 'actions') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        <button
                          onClick={() => handleDelete(user.user_id)}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            border: 'none',
                            borderRadius: 4,
                            background: deleteConfirm === user.user_id ? '#ef4444' : '#f87171',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 500
                          }}
                        >
                          {deleteConfirm === user.user_id ? 'Confirm Delete?' : 'Delete'}
                        </button>
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

                  // Number columns
                  if (col.key === 'submission_count' || col.key === 'review_count') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        <span style={{ 
                          display: 'inline-block',
                          minWidth: 24,
                          textAlign: 'center',
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: value > 0 ? '#dbeafe' : '#f1f5f9',
                          color: value > 0 ? '#1e40af' : '#64748b',
                          fontSize: 12,
                          fontWeight: 600
                        }}>
                          {value}
                        </span>
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

