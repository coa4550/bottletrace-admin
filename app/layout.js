import './globals.css';
import 'react-resizable/css/styles.css';

export const metadata = {
  title: 'BottleTrace Admin',
  description: 'Manage brands, suppliers, and relationships'
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui', margin: 0 }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <aside style={{ width: 320, background: '#0f172a', color: 'white', padding: 16 }}>
            <h2 style={{ marginTop: 8 }}>BottleTrace Admin</h2>
<nav style={{ marginTop: 24, display: 'grid', gap: 8 }}>
  <a href="/" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>Dashboard</a>

  <h4 style={{ marginTop: 16, marginBottom: 4, color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
    Data
  </h4>
  <a href="/brands" style={{ color: '#e2e8f0', textDecoration: 'none', paddingLeft: 12 }}>Brands</a>
  <a href="/suppliers" style={{ color: '#e2e8f0', textDecoration: 'none', paddingLeft: 12 }}>Suppliers</a>
  <a href="/distributors" style={{ color: '#e2e8f0', textDecoration: 'none', paddingLeft: 12 }}>Distributors</a>
  <a href="/states" style={{ color: '#e2e8f0', textDecoration: 'none', paddingLeft: 12 }}>States</a>
  <a href="/categories" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12 }}>Categories</a>
  <a href="/sub-categories" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12 }}>Sub-Categories</a>

  <h4 style={{ marginTop: 16, marginBottom: 4, color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
    Audits
  </h4>
  <a href="/audit/supplier-portfolio" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12 }}>Audit Supplier Portfolio</a>
  <a href="/audit/distributor-portfolio" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12 }}>Audit Distributor Portfolio</a>
  <a href="/audit/orphans" style={{ color:'#fbbf24', textDecoration:'none', paddingLeft: 12 }}>🗑️ Orphaned Relationships</a>

  <h4 style={{ marginTop: 16, marginBottom: 4, color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
    Data Import
  </h4>
  <a href="/import/brand" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12 }}>Import Brand</a>
  <a href="/import/supplier-portfolio" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12 }}>Import Supplier Portfolio</a>
  <a href="/import/distributor-portfolio" style={{ color:'#e2e8f0', textDecoration:'none', paddingLeft: 12 }}>Import Distributor Portfolio</a>
  <a href="/import/logs" style={{ color:'#22d3ee', textDecoration:'none', paddingLeft: 12, marginTop: 8 }}>📋 Import History</a>
</nav>
          </aside>
          <main style={{ flex: 1, padding: 24, background: '#f8fafc' }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
