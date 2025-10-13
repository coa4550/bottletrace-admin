import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/dashboard/metrics
 * Fetch all dashboard metrics using admin privileges
 */
export async function GET() {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    
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
      supabaseAdmin.from('core_brands').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('core_brands').select('*', { count: 'exact', head: true }).eq('is_orphaned', true),
      supabaseAdmin.from('core_suppliers').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('core_suppliers').select('*', { count: 'exact', head: true }).eq('is_orphaned', true),
      supabaseAdmin.from('core_distributors').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('brand_supplier').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('distributor_supplier_state').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('categories').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('sub_categories').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('core_states').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('user_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('user_submissions').select('*', { count: 'exact', head: true }).eq('status', 'under_review'),
      supabaseAdmin.from('user_submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved').gte('reviewed_at', todayStart),
      supabaseAdmin.from('user_submissions').select('*', { count: 'exact', head: true }).eq('status', 'rejected').gte('reviewed_at', todayStart),
      supabaseAdmin.from('user_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('submission_category', 'brand'),
      supabaseAdmin.from('user_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('submission_category', 'supplier'),
      supabaseAdmin.from('user_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('submission_category', 'distributor'),
      supabaseAdmin.from('user_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('submission_category', 'brand_supplier'),
      supabaseAdmin.from('user_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('submission_category', 'brand_distributor'),
      supabaseAdmin.from('user_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('submission_category', 'supplier_distributor'),
      supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo),
      supabaseAdmin.from('brand_reviews').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('supplier_reviews').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('distributor_reviews').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('user_submissions').select('*', { count: 'exact', head: true })
    ]);

    const metrics = {
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
    };

    // Fetch recent submissions
    const { data: recentSubmissions, error: submissionsError } = await supabaseAdmin
      .from('user_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(5);

    if (submissionsError) {
      console.error('Error fetching recent submissions:', submissionsError);
    }

    return NextResponse.json({
      metrics,
      recentSubmissions: recentSubmissions || []
    });

  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}

