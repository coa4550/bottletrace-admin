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
      rejected_today: 0,
      by_category: {
        brand: 0,
        supplier: 0,
        distributor: 0,
        brand_supplier: 0,
        brand_distributor: 0,
        supplier_distributor: 0
      }
    },
    users: {
      total: 0,
      with_profiles: 0,
      new_this_week: 0,
      total_reviews: 0,
      total_submissions: 0
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
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
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
        submissionsRejectedToday,
        submissionsBrand,
        submissionsSupplier,
        submissionsDistributor,
        submissionsBrandSupplier,
        submissionsBrandDistributor,
        submissionsSupplierDistributor,
        usersTotal,
        userProfilesTotal,
        usersNewThisWeek,
        brandReviewsTotal,
        supplierReviewsTotal,
        distributorReviewsTotal,
        userSubmissionsTotal
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
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true }).eq('status', 'rejected').gte('reviewed_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('brand_category', 'brand'),
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('brand_category', 'supplier'),
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('brand_category', 'distributor'),
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('brand_category', 'brand_supplier'),
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('brand_category', 'brand_distributor'),
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('brand_category', 'supplier_distributor'),
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo),
        supabase.from('brand_reviews').select('*', { count: 'exact', head: true }),
        supabase.from('supplier_reviews').select('*', { count: 'exact', head: true }),
        supabase.from('distributor_reviews').select('*', { count: 'exact', head: true }),
        supabase.from('brand_submissions').select('*', { count: 'exact', head: true })
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
          rejected_today: submissionsRejectedToday.count || 0,
          by_category: {
            brand: submissionsBrand.count || 0,
            supplier: submissionsSupplier.count || 0,
            distributor: submissionsDistributor.count || 0,
            brand_supplier: submissionsBrandSupplier.count || 0,
            brand_distributor: submissionsBrandDistributor.count || 0,
            supplier_distributor: submissionsSupplierDistributor.count || 0
          }
        },
        users: {
          total: usersTotal.count || 0,
          with_profiles: userProfilesTotal.count || 0,
          new_this_week: usersNewThisWeek.count || 0,
          total_reviews: (brandReviewsTotal.count || 0) + (supplierReviewsTotal.count || 0) + (distributorReviewsTotal.count || 0),
          total_submissions: userSubmissionsTotal.count || 0
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

      {/* User Engagement Metrics */}
      <div style={{
        padding: 24,
        background: 'white',
        border: '2px solid #e2e8f0',
        borderRadius: 8,
        marginBottom: 32
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 32 }}>👥</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>User Engagement</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 14, color: '#64748b' }}>
              Community activity and contributions
            </p>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <div style={{
            padding: 16,
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>
              Total Users
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a' }}>
              {metrics.users.total}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              Registered accounts
            </div>
          </div>

          <div style={{
            padding: 16,
            background: '#f0fdf4',
            borderRadius: 8,
            border: '1px solid #bbf7d0'
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 4, textTransform: 'uppercase' }}>
              New This Week
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#15803d' }}>
              {metrics.users.new_this_week}
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>
              {metrics.users.new_this_week > 0 ? '📈 Growing' : 'No new signups'}
            </div>
          </div>

          <div style={{
            padding: 16,
            background: '#fef3c7',
            borderRadius: 8,
            border: '1px solid #fde047'
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#854d0e', marginBottom: 4, textTransform: 'uppercase' }}>
              With Profiles
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#a16207' }}>
              {metrics.users.with_profiles}
            </div>
            <div style={{ fontSize: 11, color: '#ca8a04', marginTop: 4 }}>
              {metrics.users.total > 0 ? Math.round((metrics.users.with_profiles / metrics.users.total) * 100) + '%' : '0%'} complete
            </div>
          </div>

          <div style={{
            padding: 16,
            background: '#dbeafe',
            borderRadius: 8,
            border: '1px solid #93c5fd'
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 4, textTransform: 'uppercase' }}>
              Total Reviews
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1e3a8a' }}>
              {metrics.users.total_reviews}
            </div>
            <div style={{ fontSize: 11, color: '#2563eb', marginTop: 4 }}>
              User ratings posted
            </div>
          </div>

          <div style={{
            padding: 16,
            background: '#f3e8ff',
            borderRadius: 8,
            border: '1px solid #d8b4fe'
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b21a8', marginBottom: 4, textTransform: 'uppercase' }}>
              Submissions
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>
              {metrics.users.total_submissions}
            </div>
            <div style={{ fontSize: 11, color: '#9333ea', marginTop: 4 }}>
              Data contributions
            </div>
          </div>
        </div>
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

      {/* Reviews Section - Prominent */}
      {(metrics.submissions.pending > 0 || metrics.submissions.under_review > 0) && (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            padding: 24,
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '3px solid #fbbf24',
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(251, 191, 36, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 48 }}>🔔</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#92400e' }}>
                  Reviews Needed
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 15, color: '#92400e' }}>
                  User submissions are waiting for your review
                </p>
              </div>
              <a 
                href="/admin/submissions"
                style={{
                  padding: '12px 24px',
                  background: '#92400e',
                  color: 'white',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: 16,
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(146, 64, 14, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#78350f';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#92400e';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Review Now →
              </a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              <div style={{
                padding: 16,
                background: 'rgba(255, 255, 255, 0.7)',
                borderRadius: 8,
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
                  PENDING
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#92400e' }}>
                  {metrics.submissions.pending}
                </div>
              </div>
              <div style={{
                padding: 16,
                background: 'rgba(255, 255, 255, 0.7)',
                borderRadius: 8,
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>
                  IN REVIEW
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>
                  {metrics.submissions.under_review}
                </div>
              </div>
              <div style={{
                padding: 16,
                background: 'rgba(255, 255, 255, 0.7)',
                borderRadius: 8,
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 4 }}>
                  APPROVED TODAY
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#065f46' }}>
                  {metrics.submissions.approved_today}
                </div>
              </div>
              <div style={{
                padding: 16,
                background: 'rgba(255, 255, 255, 0.7)',
                borderRadius: 8,
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>
                  REJECTED TODAY
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#991b1b' }}>
                  {metrics.submissions.rejected_today}
                </div>
              </div>
            </div>

            {/* Reviews by Category */}
            <div style={{
              padding: 16,
              background: 'rgba(255, 255, 255, 0.8)',
              borderRadius: 8,
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#92400e', marginBottom: 12 }}>
                Pending Reviews by Type:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.5)', borderRadius: 6 }}>
                  <span style={{ fontSize: 13, color: '#78350f', fontWeight: 500 }}>🏷️ Brands</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#92400e' }}>
                    {metrics.submissions.by_category.brand}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.5)', borderRadius: 6 }}>
                  <span style={{ fontSize: 13, color: '#78350f', fontWeight: 500 }}>🏭 Suppliers</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#92400e' }}>
                    {metrics.submissions.by_category.supplier}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.5)', borderRadius: 6 }}>
                  <span style={{ fontSize: 13, color: '#78350f', fontWeight: 500 }}>🚚 Distributors</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#92400e' }}>
                    {metrics.submissions.by_category.distributor}
                  </span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.5)', borderRadius: 6 }}>
                  <span style={{ fontSize: 12, color: '#78350f', fontWeight: 500 }}>🔗 Brand-Supplier</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#92400e' }}>
                    {metrics.submissions.by_category.brand_supplier}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.5)', borderRadius: 6 }}>
                  <span style={{ fontSize: 12, color: '#78350f', fontWeight: 500 }}>🔗 Brand-Dist.</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#92400e' }}>
                    {metrics.submissions.by_category.brand_distributor}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.5)', borderRadius: 6 }}>
                  <span style={{ fontSize: 12, color: '#78350f', fontWeight: 500 }}>🔗 Supplier-Dist.</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#92400e' }}>
                    {metrics.submissions.by_category.supplier_distributor}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submissions & Data Quality Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        {/* Pending Submissions Summary (Compact) */}
        <div style={{
          padding: 20,
          background: 'white',
          border: '2px solid #e2e8f0',
          borderRadius: 8
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Submissions Overview
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                {metrics.submissions.pending + metrics.submissions.under_review}
              </div>
            </div>
            <div style={{ fontSize: 32 }}>📝</div>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
            {metrics.submissions.pending} pending · {metrics.submissions.under_review} in review
          </div>
          <div style={{ fontSize: 12, color: '#64748b', paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
            Today: {metrics.submissions.approved_today} approved · {metrics.submissions.rejected_today} rejected
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Recent Submissions</h2>
            <a 
              href="/admin/submissions" 
              style={{ 
                color: '#3b82f6', 
                textDecoration: 'none', 
                fontSize: 14, 
                fontWeight: 500,
                padding: '6px 12px',
                border: '1px solid #3b82f6',
                borderRadius: 6,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#3b82f6';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#3b82f6';
              }}
            >
              View All →
            </a>
          </div>
          <div style={{
            background: 'white',
            border: '2px solid #e2e8f0',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            {recentSubmissions.map((submission, index) => (
              <a
                key={submission.brand_submission_id}
                href="/admin/submissions"
                style={{
                  display: 'block',
                  padding: '16px 20px',
                  borderBottom: index < recentSubmissions.length - 1 ? '1px solid #f1f5f9' : 'none',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <span style={{ 
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '3px 8px',
                      background: '#dbeafe',
                      color: '#1e40af',
                      borderRadius: 4
                    }}>
                      {getSubmissionTypeLabel(submission.submission_type)}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 500, color: '#0f172a' }}>
                      {submission.brand_name_submitted || submission.supplier_name_submitted || submission.distributor_name_submitted || 'Unknown'}
                    </span>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    background: getStatusColor(submission.status) + '20',
                    color: getStatusColor(submission.status),
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {submission.status}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: '#64748b' }}>
                  <span>📅 {new Date(submission.submitted_at).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                  {submission.brand_category && (
                    <span>📁 {getCategoryLabel(submission.brand_category)}</span>
                  )}
                  {submission.user_first_name && (
                    <span>👤 {submission.user_first_name} {submission.user_last_name}</span>
                  )}
                </div>
              </a>
            ))}
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
          <QuickActionButton href="/admin/submissions" icon="✅" label="Review Submissions" highlight={metrics.submissions.pending > 0} />
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

function QuickActionButton({ href, icon, label, highlight = false }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        background: highlight ? '#fef3c7' : 'white',
        border: highlight ? '2px solid #fbbf24' : '1px solid #e2e8f0',
        borderRadius: 6,
        textDecoration: 'none',
        color: highlight ? '#92400e' : '#0f172a',
        fontSize: 14,
        fontWeight: highlight ? 600 : 500,
        transition: 'all 0.2s',
        boxShadow: highlight ? '0 2px 8px rgba(251, 191, 36, 0.2)' : 'none'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = highlight ? '#fde68a' : '#f8fafc';
        e.currentTarget.style.borderColor = highlight ? '#f59e0b' : '#3b82f6';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = highlight ? '#fef3c7' : 'white';
        e.currentTarget.style.borderColor = highlight ? '#fbbf24' : '#e2e8f0';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span>{label}</span>
      {highlight && (
        <span style={{
          marginLeft: 'auto',
          width: 8,
          height: 8,
          background: '#ef4444',
          borderRadius: '50%',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }} />
      )}
    </a>
  );
}
