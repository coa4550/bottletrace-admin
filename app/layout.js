export const metadata = {
  title: 'BottleTrace Admin',
  description: 'Manage brands, distributors, suppliers, and relationships'
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui', margin: 0 }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <aside style={{ width: 260, background: '#0f172a', color: 'white', padding: 16 }}>
            <h2 style={{ marginTop: 8 }}>BottleTrace Admin</h2>
<nav style={{ marginTop: 24, display: 'grid', gap: 10 }}>
  <a href="/" style={{ color: '#e2e8f0', textDecoration: 'none' }}>Dashboard</a>
  <a href="/brands" style={{ color: '#e2e8f0', textDecoration: 'none' }}>Brands</a>
  <a href="/suppliers" style={{ color: '#e2e8f0', textDecoration: 'none' }}>Suppliers</a>
  <a href="/distributors" style={{ color: '#e2e8f0', textDecoration: 'none' }}>Distributors</a>
  <a href="/states" style={{ color: '#e2e8f0', textDecoration: 'none' }}>States</a>

  <h4 style={{ marginTop: 20, color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' }}>
    Relationships
  </h4>
  <a href="/relationships/brand-supplier" style={{ color:'#e2e8f0', textDecoration:'none' }}>Brand ↔ Supplier ↔ State</a>
  <a href="/relationships/brand-distributor" style={{ color:'#e2e8f0', textDecoration:'none' }}>Brand ↔ Distributor ↔ State</a>

  <a href="/bulk" style={{ color: '#22d3ee', textDecoration: 'none', marginTop: 16 }}>
    Bulk Import / Edit
  </a>
</nav>
          </aside>
          <main style={{ flex: 1, padding: 24, background: '#f8fafc' }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
