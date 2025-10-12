'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    brands: { total: 0, orphaned: 0, with_suppliers: 0 },
    suppliers: { total: 0, orphaned: 0, with_distributors: 0 },
    distributors: { total: 0 },
    relationships: {
      brand_supplier: 0,
      distributor_supplier: 0
    },
    submissions: {
      pending: 0,
      under_review: 0,
      approved_today: 0,
      rejected_today: 0
    },
    categories: { total: 0 },
    sub_categories: { total: 0 },
    states: { total: 0 }
  });
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMetrics(),
        fetchRecentSubmissions()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      // Fetch brand counts
      const [
        brandsTotal,
        brandsOrphaned,
        suppliersTotal,
        suppliersOrphaned,
        distributorsTotal,
        brandSupplierRels,
        distributorSupplierRels,
        categoriesTotal,
        subCategoriesTotal,
        statesTotal,
        submissionsPending,
        submissionsUnderReview,
        submissionsApprovedToday,
        submissionsRejectedToday
      ] = await Promise.all([
        supabase.from('core_brands').select('*', { count: 'exact', head: true }),
        supabase.from('core_brands').select('*', { count: 'exact', head: true }).eq('is_orphaned', true),
        supabase.from('core_suppliers').select('*', { count: 'exact', head: true }),
        supabase.from('core_suppliers').select('*', { count: 'exact', head: true }).eq('is_orphaned', true),
        supabase.from('core_distributors').select('*', { count: 'exact', head: true }),
        supabase.from('brand_supplier').select('*', { count: 'exact', head: true }),
        supabase.from('distributor_supplier_state').select('*', { count: 'exact', head: true }),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        supabase.from('sub_categories').select('*', { count: 'exact', head: true }),
        supabase.from('core_states').select('*', { count: 'exact', head: true }),
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true }).eq('status', 'under_review'),
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved').gte('reviewed_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true }).eq('status', 'rejected').gte('reviewed_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      ]);

      setMetrics({
        brands: {
          total: brandsTotal.count || 0,
          orphaned: brandsOrphaned.count || 0,
          with_suppliers: (brandsTotal.count || 0) - (brandsOrphaned.count || 0)
        },
        suppliers: {
          total: suppliersTotal.count || 0,
          orphaned: suppliersOrphaned.count || 0,
          with_distributors: (suppliersTotal.count || 0) - (suppliersOrphaned.count || 0)
        },
        distributors: {
          total: distributorsTotal.count || 0
        },
        relationships: {
          brand_supplier: brandSupplierRels.count || 0,
          distributor_supplier: distributorSupplierRels.count || 0
        },
        submissions: {
          pending: submissionsPending.count || 0,
          under_review: submissionsUnderReview.count || 0,
          approved_today: submissionsApprovedToday.count || 0,
          rejected_today: submissionsRejectedToday.count || 0
        },
        categories: {
          total: categoriesTotal.count || 0
        },
        sub_categories: {
          total: subCategoriesTotal.count || 0
        },
        states: {
          total: statesTotal.count || 0
        }
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      throw error;
    }
  };

  const fetchRecentSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('brand_submissions')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching recent submissions:', error);
      throw error;
    }
  };

  const getSubmissionTypeLabel = (type) => {
    switch (type) {
      case 'Addition': return '➕ Addition';
      case 'Change': return '✏️ Change';
      case 'Orphan_Correction': return '🔗 Orphan Fix';
      default: return type;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#fbbf24';
      case 'under_review': return '#3b82f6';
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Dashboard</h1>
        <p style={{ color: '#64748b' }}>Loading metrics...</p>
      </div>
    );
  }

  const dataQualityScore = Math.round(
    ((metrics.brands.with_suppliers / metrics.brands.total) * 40 +
    (metrics.suppliers.with_distributors / metrics.suppliers.total) * 40 +
    (metrics.relationships.brand_supplier > 0 ? 20 : 0))
  );

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>BottleTrace Admin Dashboard</h1>
        <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
          Overview of your spirits industry database
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: 16, 
        marginBottom: 32 
      }}>
        {/* Brands */}
        <MetricCard
          title="Brands"
          value={metrics.brands.total}
          subtitle={`${metrics.brands.orphaned} orphaned`}
          icon="🏷️"
          link="/brands"
          warning={metrics.brands.orphaned > 0}
        />

        {/* Suppliers */}
        <MetricCard
          title="Suppliers"
          value={metrics.suppliers.total}
          subtitle={`${metrics.suppliers.orphaned} orphaned`}
          icon="🏭"
          link="/suppliers"
          warning={metrics.suppliers.orphaned > 0}
        />

        {/* Distributors */}
        <MetricCard
          title="Distributors"
          value={metrics.distributors.total}
          subtitle="Active distributors"
          icon="🚚"
          link="/distributors"
        />

        {/* Brand-Supplier Relationships */}
        <MetricCard
          title="Brand ↔ Supplier"
          value={metrics.relationships.brand_supplier}
          subtitle="Relationships"
          icon="🔗"
          link="/relationships/brand-supplier"
        />
      </div>

      {/* Secondary Metrics */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: 16, 
        marginBottom: 32 
      }}>
        <SmallMetricCard
          title="Categories"
          value={metrics.categories.total}
          link="/categories"
        />
        <SmallMetricCard
          title="Sub-Categories"
          value={metrics.sub_categories.total}
          link="/sub-categories"
        />
        <SmallMetricCard
          title="States/Regions"
          value={metrics.states.total}
          link="/states"
        />
        <SmallMetricCard
          title="Dist. ↔ Supplier"
          value={metrics.relationships.distributor_supplier}
          link="/relationships/brand-supplier"
        />
      </div>

      {/* Submissions & Data Quality Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        {/* Pending Submissions Alert */}
        <div style={{
          padding: 20,
          background: metrics.submissions.pending > 0 ? '#fef3c7' : '#f8fafc',
          border: `2px solid ${metrics.submissions.pending > 0 ? '#fbbf24' : '#e2e8f0'}`,
          borderRadius: 8
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pending Review
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: metrics.submissions.pending > 0 ? '#92400e' : '#64748b', marginTop: 4 }}>
                {metrics.submissions.pending}
              </div>
            </div>
            <div style={{ fontSize: 32 }}>📝</div>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            {metrics.submissions.under_review} under review
          </div>
          <a 
            href="/admin/submissions"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: metrics.submissions.pending > 0 ? '#92400e' : '#64748b',
              color: 'white',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            Review Submissions →
          </a>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 12, paddingTop: 12, borderTop: '1px solid #d1d5db' }}>
            Today: {metrics.submissions.approved_today} approved, {metrics.submissions.rejected_today} rejected
          </div>
        </div>

        {/* Data Quality Score */}
        <div style={{
          padding: 20,
          background: 'white',
          border: '2px solid #e2e8f0',
          borderRadius: 8
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Data Quality
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: dataQualityScore >= 80 ? '#10b981' : dataQualityScore >= 60 ? '#fbbf24' : '#ef4444', marginTop: 4 }}>
                {dataQualityScore}%
              </div>
            </div>
            <div style={{ fontSize: 32 }}>📊</div>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
            {metrics.brands.with_suppliers} brands linked ({Math.round((metrics.brands.with_suppliers / metrics.brands.total) * 100)}%)
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            {metrics.suppliers.with_distributors} suppliers linked ({Math.round((metrics.suppliers.with_distributors / metrics.suppliers.total) * 100)}%)
          </div>
          <a 
            href="/audit/orphans"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            Fix Orphans →
          </a>
        </div>
      </div>

      {/* Recent Submissions */}
      {recentSubmissions.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Recent Submissions</h2>
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            {recentSubmissions.map((submission, index) => (
              <div 
                key={submission.brand_submission_id}
                style={{
                  padding: '12px 16px',
                  borderBottom: index < recentSubmissions.length - 1 ? '1px solid #f1f5f9' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14 }}>{getSubmissionTypeLabel(submission.submission_type)}</span>
                  <span style={{ fontSize: 14, color: '#64748b' }}>
                    {submission.brand_name_submitted || submission.supplier_name_submitted || submission.distributor_name_submitted || 'Unknown'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {new Date(submission.submitted_at).toLocaleDateString()}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    background: getStatusColor(submission.status) + '20',
                    color: getStatusColor(submission.status),
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500
                  }}>
                    {submission.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <a 
              href="/admin/submissions" 
              style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}
            >
              View All Submissions →
            </a>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: 12 
        }}>
          <QuickActionButton href="/import/brand" icon="📥" label="Import Brands" />
          <QuickActionButton href="/import/supplier-portfolio" icon="📥" label="Import Portfolio" />
          <QuickActionButton href="/audit/orphans" icon="🍾" label="Fix Orphans" />
          <QuickActionButton href="/visualize/relationships" icon="📊" label="Visualize Network" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, link, warning = false }) {
  return (
    <a
      href={link}
      style={{
        display: 'block',
        padding: 20,
        background: 'white',
        border: warning ? '2px solid #fbbf24' : '2px solid #e2e8f0',
        borderRadius: 8,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 0.2s',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: warning ? '#92400e' : '#0f172a', marginTop: 8 }}>
            {value.toLocaleString()}
          </div>
          <div style={{ fontSize: 13, color: warning ? '#92400e' : '#64748b', marginTop: 4 }}>
            {subtitle}
          </div>
        </div>
        <div style={{ fontSize: 32, opacity: 0.8 }}>{icon}</div>
      </div>
    </a>
  );
}

function SmallMetricCard({ title, value, link }) {
  return (
    <a
      href={link}
      style={{
        display: 'block',
        padding: 16,
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#3b82f6';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#e2e8f0';
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
        {value.toLocaleString()}
      </div>
    </a>
  );
}

function QuickActionButton({ href, icon, label }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        textDecoration: 'none',
        color: '#0f172a',
        fontSize: 14,
        fontWeight: 500,
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f8fafc';
        e.currentTarget.style.borderColor = '#3b82f6';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'white';
        e.currentTarget.style.borderColor = '#e2e8f0';
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span>{label}</span>
    </a>
  );
}
