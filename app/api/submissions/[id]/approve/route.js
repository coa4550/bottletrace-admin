import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/submissions/[id]/approve
 * Approve a submission and apply the changes to the database
 */
export async function POST(req, { params }) {
  try {
    const { id } = params;

    // Fetch the submission
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('user_submissions')
      .select('*')
      .eq('submission_id', id)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (submission.status === 'approved') {
      return NextResponse.json(
        { error: 'Submission already approved' },
        { status: 400 }
      );
    }

    const { submission_category, submission_type, payload } = submission;

    // Apply the changes based on submission type and category
    let result;
    
    if (submission_type === 'Orphan_Correction') {
      if (submission_category === 'brand_supplier') {
        // Extract brand and supplier names from payload
        const brandName = payload.brand_name;
        const supplierName = payload.supplier_name;
        
        if (!brandName || !supplierName) {
          return NextResponse.json(
            { error: 'Missing brand_name or supplier_name in payload' },
            { status: 400 }
          );
        }
        
        // Look up brand and supplier IDs
        const { data: brand, error: brandError } = await supabaseAdmin
          .from('core_brands')
          .select('brand_id')
          .eq('brand_name', brandName)
          .single();
          
        if (brandError || !brand) {
          return NextResponse.json(
            { error: `Brand "${brandName}" not found` },
            { status: 404 }
          );
        }
        
        const { data: supplier, error: supplierError } = await supabaseAdmin
          .from('core_suppliers')
          .select('supplier_id')
          .eq('supplier_name', supplierName)
          .single();
          
        if (supplierError || !supplier) {
          return NextResponse.json(
            { error: `Supplier "${supplierName}" not found` },
            { status: 404 }
          );
        }
        
        // Link orphaned brand to suggested supplier
        const { error: insertError } = await supabaseAdmin
          .from('brand_supplier')
          .insert({
            brand_id: brand.brand_id,
            supplier_id: supplier.supplier_id,
            relationship_source: 'user_submission',
            is_verified: true,
            last_verified_at: new Date().toISOString()
          });

        if (insertError) {
          // Check if it's a duplicate key error (relationship already exists)
          if (insertError.code === '23505') {
            // Relationship already exists, just update the submission status
            result = { message: 'Relationship already exists, marking as approved' };
          } else {
            throw insertError;
          }
        } else {
          result = { message: 'Brand-supplier relationship created successfully' };
        }
        
        // The trigger will automatically clear the orphan status
        
      } else if (submission_category === 'supplier_distributor') {
        // Extract supplier and distributor names from payload
        const supplierName = payload.supplier_name;
        const distributorName = payload.distributor_name;
        
        if (!supplierName || !distributorName) {
          return NextResponse.json(
            { error: 'Missing supplier_name or distributor_name in payload' },
            { status: 400 }
          );
        }
        
        // Look up supplier and distributor IDs
        const { data: supplier, error: supplierError } = await supabaseAdmin
          .from('core_suppliers')
          .select('supplier_id')
          .eq('supplier_name', supplierName)
          .single();
          
        if (supplierError || !supplier) {
          return NextResponse.json(
            { error: `Supplier "${supplierName}" not found` },
            { status: 404 }
          );
        }
        
        const { data: distributor, error: distributorError } = await supabaseAdmin
          .from('core_distributors')
          .select('distributor_id')
          .eq('distributor_name', distributorName)
          .single();
          
        if (distributorError || !distributor) {
          return NextResponse.json(
            { error: `Distributor "${distributorName}" not found` },
            { status: 404 }
          );
        }
        
        // For now, we'll need a default state or extract it from payload
        // Let's assume we have a default state or extract from user context
        const { data: defaultState } = await supabaseAdmin
          .from('core_states')
          .select('state_id')
          .eq('state_code', 'CA') // Default to California for now
          .single();
          
        if (!defaultState) {
          return NextResponse.json(
            { error: 'Default state not found' },
            { status: 500 }
          );
        }
        
        // Link orphaned supplier to suggested distributor in a state
        const { error: insertError } = await supabaseAdmin
          .from('distributor_supplier_state')
          .insert({
            distributor_id: distributor.distributor_id,
            supplier_id: supplier.supplier_id,
            state_id: defaultState.state_id
          });

        if (insertError) {
          // Check if it's a duplicate key error (relationship already exists)
          if (insertError.code === '23505') {
            result = { message: 'Relationship already exists, marking as approved' };
          } else {
            throw insertError;
          }
        } else {
          result = { message: 'Supplier-distributor relationship created successfully' };
        }
        
        // The trigger will automatically clear the orphan status
        
      } else {
        return NextResponse.json(
          { error: 'Unsupported submission_category for orphan correction' },
          { status: 400 }
        );
      }
    } else {
      // Handle other submission types (Addition, Change) if needed
      return NextResponse.json(
        { error: 'Only Orphan_Correction submissions are currently supported for approval' },
        { status: 400 }
      );
    }

    // Update submission status to approved
    const { error: updateError } = await supabaseAdmin
      .from('user_submissions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString()
      })
      .eq('submission_id', id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'Submission approved successfully'
    });

  } catch (error) {
    console.error('Error approving submission:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

