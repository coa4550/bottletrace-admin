'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useState } from 'react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Navigation() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error logging out:', error);
      alert('Failed to log out. Please try again.');
      setLoggingOut(false);
    }
  };

  return (
    <aside style={{ width: 270, minWidth: 270, flexShrink: 0, background: '#0f172a', color: 'white', padding: 16, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <h2 style={{ marginTop: 8 }}>BottleTrace Admin</h2>
      
      <nav style={{ marginTop: 16, display: 'grid', gap: 2, flex: 1 }}>
        <a href="/" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: 15, fontWeight: 500, padding: '6px 0' }}>Dashboard</a>

        <h4 style={{ marginTop: 8, marginBottom: 2, color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
          Data
        </h4>
        <a href="/brands" style={{ color: '#e2e8f0', textDecoration: 'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Brands</a>
        <a href="/suppliers" style={{ color: '#e2e8f0', textDecoration: 'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Suppliers</a>
        <a href="/distributors" style={{ color: '#e2e8f0', textDecoration: 'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Distributors</a>
        <a href="/states" style={{ color: '#e2e8f0', textDecoration: 'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>States</a>
        <a href="/categories" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Categories</a>
        <a href="/sub-categories" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Sub-Categories</a>
        <a href="/users" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Users</a>
        <a href="/reviews" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Reviews</a>

        <h4 style={{ marginTop: 8, marginBottom: 2, color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
          Admin
        </h4>
        <a href="/admin/submissions" style={{ color:'#34d399', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>📝 Submissions Dashboard</a>
        <a href="/audit/orphans" style={{ color:'#fbbf24', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>🍾 Orphaned Records</a>

        <h4 style={{ marginTop: 8, marginBottom: 2, color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
          Audits
        </h4>
        <a href="/audit/supplier-portfolio" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Audit Supplier Portfolio</a>
        <a href="/audit/distributor-portfolio" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Audit Distributor Portfolio</a>

        <h4 style={{ marginTop: 8, marginBottom: 2, color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
          Visualization
        </h4>
        <a href="/visualize/relationships" style={{ color:'#a78bfa', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>📊 Relationship Network</a>

        <h4 style={{ marginTop: 8, marginBottom: 2, color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
          Data Import
        </h4>
        <a href="/import/brand" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Import Brand</a>
        <a href="/import/supplier-portfolio" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Import Supplier Portfolio</a>
        <a href="/import/distributor-portfolio" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>Import Distributor Portfolio</a>
        <a href="/import/logs" style={{ color:'#22d3ee', textDecoration:'none', paddingLeft: 12, padding: '4px 0 4px 12px' }}>📋 Import History</a>
      </nav>

      {/* Logout Button */}
      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #334155' }}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: loggingOut ? '#475569' : '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => !loggingOut && (e.currentTarget.style.background = '#dc2626')}
          onMouseLeave={(e) => !loggingOut && (e.currentTarget.style.background = '#ef4444')}
        >
          <span>{loggingOut ? '⏳' : '🚪'}</span>
          {loggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </aside>
  );
}

