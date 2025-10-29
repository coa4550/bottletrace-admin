import './globals.css';
import 'react-resizable/css/styles.css';
import Navigation from '@/components/Navigation';

export const metadata = {
  title: 'BottleTrace Admin',
  description: 'Manage brands, suppliers, and relationships'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui', margin: 0, overflow: 'hidden', height: '100vh' }}>
        <div style={{ display: 'flex', height: '100vh' }}>
          <Navigation />
          <main style={{ 
            flex: 1, 
            padding: 24, 
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            overflowX: 'auto',
            overflowY: 'auto',
            height: '100vh'
          }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
// Force redeploy - Mon Oct 13 16:30:53 MDT 2025
