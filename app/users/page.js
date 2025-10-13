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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    jobTitle: 'Admin',
    employer: '',
    location: ''
  });
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(true);
  const [createdPassword, setCreatedPassword] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      // Use API to get enriched user data with email addresses
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

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
      const enrichedUsers = data.users.map(user => ({
        ...user,
        submission_count: submissionCounts[user.user_id] || 0,
        review_count: reviewCounts[user.user_id] || 0
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


  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const userData = {
        ...newUser,
        password: autoGeneratePassword ? undefined : newUser.password
      };

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      // Store the password to display
      if (data.passwordGenerated) {
        setCreatedPassword(data.password);
      } else {
        // Show success message immediately for custom passwords
        alert(
          `Admin user created successfully!\n\n` +
          `Email: ${data.user.email}\n\n` +
          `The user can now sign in with their email and password.`
        );
        
        // Reset form
        setNewUser({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          jobTitle: 'Admin',
          employer: '',
          location: ''
        });
        setShowCreateModal(false);
      }

      // Refresh user list
      fetchUsers();
    } catch (err) {
      console.error('Create user error:', err);
      alert('Failed to create user: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const closePasswordModal = () => {
    setCreatedPassword(null);
    setNewUser({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      jobTitle: 'Admin',
      employer: '',
      location: ''
    });
    setShowCreateModal(false);
    setAutoGeneratePassword(true);
  };

  const copyPasswordToClipboard = () => {
    if (createdPassword) {
      navigator.clipboard.writeText(createdPassword);
      alert('Password copied to clipboard!');
    }
  };

  const handleDelete = async (userId) => {
    if (deleteConfirm !== userId) {
      setDeleteConfirm(userId);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      const response = await fetch(`/api/users?userId=${userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }
      
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      setDeleteConfirm(null);
      alert('User deleted successfully');
    } catch (err) {
      console.error('Delete error:', err.message);
      alert('Failed to delete user: ' + err.message);
    }
  };

  const columns = [
    { key: 'email', label: 'Email' },
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
      user.email?.toLowerCase().includes(searchLower) ||
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <SearchInput 
            placeholder="Search users..." 
            onSearch={setSearchTerm}
          />
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: 'nowrap'
            }}
          >
            + Create Admin User
          </button>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: 32,
            borderRadius: 8,
            maxWidth: 500,
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: 24 }}>Create Admin User</h2>
            
            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: 14
                  }}
                  placeholder="admin@example.com"
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    id="autoGenPassword"
                    checked={autoGeneratePassword}
                    onChange={(e) => setAutoGeneratePassword(e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  <label htmlFor="autoGenPassword" style={{ fontWeight: 600, cursor: 'pointer' }}>
                    Auto-generate secure password
                  </label>
                </div>
                
                {!autoGeneratePassword && (
                  <>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                      Password *
                    </label>
                    <input
                      type="password"
                      required={!autoGeneratePassword}
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        fontSize: 14
                      }}
                      placeholder="Minimum 8 characters"
                      minLength={8}
                    />
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      Minimum 8 characters
                    </p>
                  </>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 14
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 14
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Job Title
                </label>
                <input
                  type="text"
                  value={newUser.jobTitle}
                  onChange={(e) => setNewUser({...newUser, jobTitle: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: 14
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Employer
                </label>
                <input
                  type="text"
                  value={newUser.employer}
                  onChange={(e) => setNewUser({...newUser, employer: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: 14
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Location
                </label>
                <input
                  type="text"
                  value={newUser.location}
                  onChange={(e) => setNewUser({...newUser, location: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: 14
                  }}
                  placeholder="City, State"
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  style={{
                    padding: '10px 20px',
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: 6,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 14
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: '10px 20px',
                    background: creating ? '#93c5fd' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: 14
                  }}
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Display Modal */}
      {createdPassword && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            background: 'white',
            padding: 32,
            borderRadius: 8,
            maxWidth: 500,
            width: '90%'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: 16, color: '#10b981' }}>✅ Admin User Created!</h2>
            
            <div style={{ 
              background: '#f0fdf4',
              border: '2px solid #10b981',
              borderRadius: 8,
              padding: 20,
              marginBottom: 20
            }}>
              <p style={{ margin: 0, marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
                🔑 Temporary Password:
              </p>
              <div style={{
                background: 'white',
                padding: 12,
                borderRadius: 4,
                border: '1px solid #d1d5db',
                fontFamily: 'monospace',
                fontSize: 16,
                wordBreak: 'break-all',
                marginBottom: 12
              }}>
                {createdPassword}
              </div>
              <button
                onClick={copyPasswordToClipboard}
                style={{
                  padding: '8px 16px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                📋 Copy Password
              </button>
            </div>

            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: 6,
              padding: 12,
              marginBottom: 20
            }}>
              <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
                ⚠️ <strong>Important:</strong> Save this password now! It will not be shown again.
              </p>
            </div>

            <p style={{ fontSize: 14, color: '#374151', marginBottom: 20 }}>
              Share this password securely with the new admin user. They can change it after their first login.
            </p>

            <button
              onClick={closePasswordModal}
              style={{
                width: '100%',
                padding: '12px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
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

