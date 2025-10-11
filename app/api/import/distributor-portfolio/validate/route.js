import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req) {
  try {
    const { rows } = await req.json();
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    // Fetch all existing distributors
    const { data: existingDistributors, error: distributorsError } = await supabaseAdmin
      .from('core_distributors')
      .select('distributor_id, distributor_name');

    if (distributorsError) throw distributorsError;

    // Fetch all existing suppliers
    const { data: existingSuppliers, error: suppliersError } = await supabaseAdmin
      .from('core_suppliers')
      .select('supplier_id, supplier_name');

    if (suppliersError) throw suppliersError;

    // Fetch all states
    const { data: allStates, error: statesError } = await supabaseAdmin
      .from('core_states')
      .select('state_id, state_code, state_name');

    if (statesError) throw statesError;

    // Process rows and build review structure
    const distributorReviews = [];
    const distributorMap = new Map();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const distributorName = (row.distributor_name || '').trim();
      const supplierName = (row.supplier_name || '').trim();
      const stateCode = (row.state_code || '').trim().toUpperCase();

      if (!distributorName || !supplierName || !stateCode) {
        continue; // Skip invalid rows
      }

      // Find or create distributor entry
      if (!distributorMap.has(distributorName)) {
        const existingDist = existingDistributors?.find(d => d.distributor_name === distributorName);
        
        distributorMap.set(distributorName, {
          distributorName,
          distributorId: existingDist?.distributor_id || null,
          isNew: !existingDist,
          suppliers: []
        });
      }

      const distReview = distributorMap.get(distributorName);
      const existingSupp = existingSuppliers?.find(s => s.supplier_name === supplierName);
      
      distReview.suppliers.push({
        rowIndex: i,
        supplierName,
        supplierId: existingSupp?.supplier_id || null,
        isNew: !existingSupp,
        stateCode,
        stateName: allStates?.find(s => s.state_code === stateCode)?.state_name || null
      });
    }

    // Convert map to array
    distributorMap.forEach(review => distributorReviews.push(review));

    // Calculate summary stats
    const newDistributors = distributorReviews.filter(d => d.isNew).length;
    const existingDistributors = distributorReviews.filter(d => !d.isNew).length;
    
    let newSuppliers = 0;
    let existingSuppliers = 0;
    let totalRelationships = 0;

    distributorReviews.forEach(d => {
      d.suppliers.forEach(s => {
        if (s.isNew) newSuppliers++;
        else existingSuppliers++;
        totalRelationships++;
      });
    });

    return NextResponse.json({
      distributorReviews,
      summary: {
        newDistributors,
        existingDistributors,
        newSuppliers,
        existingSuppliers,
        totalRelationships
      },
      allStates
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
