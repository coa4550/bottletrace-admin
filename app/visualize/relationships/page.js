'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ResponsiveSankey } from '@nivo/sankey';

const supabase = createClient(
  'https://pgycxpmqnrjsusgoinxz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBneWN4cG1xbnJqc3VzZ29pbnh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNTMxNjIsImV4cCI6MjA3MjgyOTE2Mn0.GB-HMHWn7xy5uoXpHhTv8TBO6CNl3a877K5DBIH7ekE'
);

export default function RelationshipsVisualizationPage() {
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [sankeyData, setSankeyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ distributors: 0, suppliers: 0, brands: 0 });

  // Fetch states on mount
  useEffect(() => {
    async function fetchStates() {
      const { data, error } = await supabase
        .from('core_states')
        .select('state_id, state_name, state_abbr')
        .order('state_name');
      
      if (error) {
        console.error('Error fetching states:', error);
      } else {
        setStates(data || []);
      }
    }
    fetchStates();
  }, []);

  // Fetch and build Sankey data when state is selected
  useEffect(() => {
    if (!selectedState) {
      setSankeyData(null);
      return;
    }

    async function buildSankeyData() {
      setLoading(true);
      try {
        // 1. Get all distributor-brand relationships for this state
        const { data: distributorBrands, error: dbError } = await supabase
          .from('brand_distributor_state')
          .select(`
            distributor_id,
            brand_id,
            core_distributors!inner(distributor_name),
            core_brands!inner(brand_name)
          `)
          .eq('state_id', selectedState);

        if (dbError) throw dbError;

        console.log('Distributor-Brand relationships:', distributorBrands?.length);

        if (!distributorBrands || distributorBrands.length === 0) {
          setSankeyData({ nodes: [], links: [] });
          setStats({ distributors: 0, suppliers: 0, brands: 0 });
          return;
        }

        // Extract unique brand IDs
        const brandIds = [...new Set(distributorBrands.map(db => db.brand_id))];
        
        // 2. Get all supplier-brand relationships for these brands
        const { data: supplierBrands, error: sbError } = await supabase
          .from('brand_supplier')
          .select(`
            supplier_id,
            brand_id,
            core_suppliers!inner(supplier_name)
          `)
          .in('brand_id', brandIds);

        if (sbError) throw sbError;

        console.log('Supplier-Brand relationships:', supplierBrands?.length);

        // Build nodes and links
        const nodes = new Set();
        const links = [];

        // Track unique entities
        const distributorSet = new Set();
        const supplierSet = new Set();
        const brandSet = new Set();

        // Create distributor -> brand links (we'll connect through suppliers)
        const distributorBrandMap = new Map(); // distributor -> brands
        distributorBrands.forEach(db => {
          const distId = `dist_${db.distributor_id}`;
          const distName = db.core_distributors.distributor_name;
          const brandId = `brand_${db.brand_id}`;
          const brandName = db.core_brands.brand_name;

          nodes.add(JSON.stringify({ id: distId, label: distName, type: 'distributor' }));
          nodes.add(JSON.stringify({ id: brandId, label: brandName, type: 'brand' }));
          
          distributorSet.add(db.distributor_id);
          brandSet.add(db.brand_id);

          if (!distributorBrandMap.has(distId)) {
            distributorBrandMap.set(distId, new Set());
          }
          distributorBrandMap.get(distId).add(brandId);
        });

        // Create supplier -> brand links
        const supplierBrandMap = new Map(); // supplier -> brands
        supplierBrands.forEach(sb => {
          const suppId = `supp_${sb.supplier_id}`;
          const suppName = sb.core_suppliers.supplier_name;
          const brandId = `brand_${sb.brand_id}`;

          nodes.add(JSON.stringify({ id: suppId, label: suppName, type: 'supplier' }));
          
          supplierSet.add(sb.supplier_id);

          if (!supplierBrandMap.has(suppId)) {
            supplierBrandMap.set(suppId, new Set());
          }
          supplierBrandMap.get(suppId).add(brandId);
        });

        // Create distributor -> supplier links (through shared brands)
        distributorBrandMap.forEach((brands, distId) => {
          const sharedSuppliers = new Map(); // supplier -> count of shared brands
          
          brands.forEach(brandId => {
            // Find suppliers for this brand
            supplierBrandMap.forEach((supplierBrands, suppId) => {
              if (supplierBrands.has(brandId)) {
                sharedSuppliers.set(suppId, (sharedSuppliers.get(suppId) || 0) + 1);
              }
            });
          });

          // Create links from distributor to suppliers
          sharedSuppliers.forEach((count, suppId) => {
            links.push({
              source: distId,
              target: suppId,
              value: count
            });
          });
        });

        // Create supplier -> brand links
        supplierBrandMap.forEach((brands, suppId) => {
          brands.forEach(brandId => {
            // Check if this brand is in our filtered set
            if ([...distributorBrandMap.values()].some(brandSet => brandSet.has(brandId))) {
              links.push({
                source: suppId,
                target: brandId,
                value: 1
              });
            }
          });
        });

        const uniqueNodes = Array.from(nodes).map(n => JSON.parse(n));

        console.log('Nodes:', uniqueNodes.length);
        console.log('Links:', links.length);

        setSankeyData({
          nodes: uniqueNodes,
          links: links
        });

        setStats({
          distributors: distributorSet.size,
          suppliers: supplierSet.size,
          brands: brandSet.size
        });

      } catch (error) {
        console.error('Error building Sankey data:', error);
        setSankeyData(null);
      } finally {
        setLoading(false);
      }
    }

    buildSankeyData();
  }, [selectedState]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Relationship Visualization</h1>
      <p style={{ color: '#64748b', marginTop: 8, marginBottom: 32 }}>
        Visualize distributor → supplier → brand relationships by state
      </p>

      {/* State Selector */}
      <div style={{ marginBottom: 32 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
          Select State:
        </label>
        <select
          value={selectedState || ''}
          onChange={(e) => setSelectedState(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            minWidth: 300,
            background: 'white'
          }}
        >
          <option value="">-- Choose a state --</option>
          {states.map(s => (
            <option key={s.state_id} value={s.state_id}>
              {s.state_name} ({s.state_abbr})
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Loading relationship data...</p>}

      {!loading && sankeyData && sankeyData.nodes.length === 0 && (
        <p style={{ color: '#64748b' }}>No relationships found for this state.</p>
      )}

      {!loading && sankeyData && sankeyData.nodes.length > 0 && (
        <>
          {/* Stats */}
          <div style={{ 
            display: 'flex', 
            gap: 24, 
            marginBottom: 24,
            padding: 16,
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0'
          }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1e293b' }}>
                {stats.distributors}
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Distributors</div>
            </div>
            <div style={{ borderLeft: '1px solid #cbd5e1' }} />
            <div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1e293b' }}>
                {stats.suppliers}
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Suppliers</div>
            </div>
            <div style={{ borderLeft: '1px solid #cbd5e1' }} />
            <div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1e293b' }}>
                {stats.brands}
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Brands</div>
            </div>
          </div>

          {/* Sankey Diagram */}
          <div style={{ 
            height: 800, 
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 20
          }}>
            <ResponsiveSankey
              data={sankeyData}
              margin={{ top: 20, right: 160, bottom: 20, left: 160 }}
              align="justify"
              colors={{ scheme: 'category10' }}
              nodeOpacity={1}
              nodeHoverOthersOpacity={0.35}
              nodeThickness={18}
              nodeSpacing={24}
              nodeBorderWidth={0}
              nodeBorderColor={{
                from: 'color',
                modifiers: [['darker', 0.8]]
              }}
              nodeBorderRadius={3}
              linkOpacity={0.5}
              linkHoverOthersOpacity={0.1}
              linkContract={3}
              enableLinkGradient={true}
              label={node => node.label || node.id}
              labelPosition="outside"
              labelOrientation="horizontal"
              labelPadding={16}
              labelTextColor={{
                from: 'color',
                modifiers: [['darker', 1]]
              }}
              legends={[
                {
                  anchor: 'bottom-right',
                  direction: 'column',
                  translateX: 130,
                  itemWidth: 100,
                  itemHeight: 14,
                  itemDirection: 'right-to-left',
                  itemsSpacing: 2,
                  itemTextColor: '#999',
                  symbolSize: 14,
                  effects: [
                    {
                      on: 'hover',
                      style: {
                        itemTextColor: '#000'
                      }
                    }
                  ]
                }
              ]}
              tooltip={({ node }) => (
                <div
                  style={{
                    background: 'white',
                    padding: '9px 12px',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    fontSize: 13
                  }}
                >
                  <strong>{node.label || node.id}</strong>
                  <br />
                  Value: {node.value}
                </div>
              )}
            />
          </div>
        </>
      )}

      {!selectedState && !loading && (
        <p style={{ color: '#64748b', marginTop: 40 }}>
          Please select a state to visualize relationships.
        </p>
      )}
    </div>
  );
}

