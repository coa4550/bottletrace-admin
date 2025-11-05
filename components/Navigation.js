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
    <aside style={{ 
      width: 270, 
      minWidth: 270, 
      flexShrink: 0, 
      background: 'linear-gradient(180deg, #0d9488 0%, #059669 100%)', 
      color: 'white', 
      padding: 16, 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      overflowY: 'auto', 
      boxSizing: 'border-box',
      boxShadow: '4px 0 12px rgba(0, 0, 0, 0.1)'
    }}>
      <h2 style={{ marginTop: 8, fontWeight: 700, fontSize: 20, textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>BottleTrace Admin</h2>
      
      <nav style={{ marginTop: 16, flex: 1 }}>
        <a href="/" style={{ 
          color: 'white', 
          textDecoration: 'none', 
          fontSize: 15, 
          fontWeight: 600, 
          display: 'block', 
          marginBottom: 8,
          padding: '8px 12px',
          borderRadius: 6,
          background: 'rgba(255, 255, 255, 0.1)',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
        >Dashboard</a>

        <h4 style={{ marginTop: 16, marginBottom: 8, color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>
          Data
        </h4>
        <a href="/brands" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Brands</a>
        <a href="/suppliers" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Suppliers</a>
        <a href="/distributors" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Distributors</a>
        <a href="/states" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>States</a>
        <a href="/categories" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Categories</a>
        <a href="/sub-categories" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Sub-Categories</a>
        <a href="/users" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Users</a>
        <a href="/reviews" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Reviews</a>

        <h4 style={{ marginTop: 16, marginBottom: 8, color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>
          Admin
        </h4>
        <a href="/admin/submissions" style={{ color: '#a7f3d0', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, fontWeight: 500, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>📝 Submissions Dashboard</a>
        <a href="/audit/orphans" style={{ color: '#fde68a', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, fontWeight: 500, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>🍾 Orphaned Records</a>

        <h4 style={{ marginTop: 16, marginBottom: 8, color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>
          Audits
        </h4>
        <a href="/audit/supplier-portfolio" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Audit Supplier Portfolio</a>
        <a href="/audit/distributor-portfolio" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Audit Distributor Portfolio</a>

        <h4 style={{ marginTop: 16, marginBottom: 8, color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>
          Visualization
        </h4>
        <a href="/visualize/relationships" style={{ color: '#c4b5fd', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, fontWeight: 500, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>📊 Relationship Network</a>

        <h4 style={{ marginTop: 16, marginBottom: 8, color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>
          Data Import
        </h4>
        <a href="/import/brand" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Import Brand</a>
        <a href="/import/add-supplier" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Import Supplier</a>
        <a href="/import/add-distributor" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Import Distributor</a>
        <a href="/import/supplier-portfolio" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Import Supplier Portfolio</a>
        <a href="/import/distributor-portfolio" style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Import Distributor Portfolio</a>
        <a href="/import/logs" style={{ color: '#a5f3fc', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, fontWeight: 500, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>📋 Import History</a>

        <h4 style={{ marginTop: 16, marginBottom: 8, color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>
          Staging Review
        </h4>
        <a href="/staging/review/brands" style={{ color: '#fef3c7', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, fontWeight: 500, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Review Brands</a>
        <a href="/staging/review/suppliers" style={{ color: '#fef3c7', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, fontWeight: 500, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Review Suppliers</a>
        <a href="/staging/review/distributors" style={{ color: '#fef3c7', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, fontWeight: 500, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Review Distributors</a>
        <a href="/staging/review/supplier-portfolio" style={{ color: '#fef3c7', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, fontWeight: 500, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Review Supplier Portfolio</a>
        <a href="/staging/review/distributor-portfolio" style={{ color: '#fef3c7', textDecoration: 'none', paddingLeft: 12, display: 'block', marginBottom: 6, padding: '6px 12px', borderRadius: 4, fontWeight: 500, transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>Review Distributor Portfolio</a>
      </nav>

      {/* Logout Button */}
      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: loggingOut ? 'rgba(0, 0, 0, 0.3)' : 'rgba(239, 68, 68, 0.9)',
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
            transition: 'background 0.2s',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }}
          onMouseEnter={(e) => !loggingOut && (e.currentTarget.style.background = 'rgba(220, 38, 38, 0.9)')}
          onMouseLeave={(e) => !loggingOut && (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)')}
        >
          <span>{loggingOut ? '⏳' : '🚪'}</span>
          {loggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </aside>
  );
}

