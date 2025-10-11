'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ResponsiveSankey } from '@nivo/sankey';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgycxpmqnrjsusgoinxz.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBneWN4cG1xbnJqc3VzZ29pbnh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNTMxNjIsImV4cCI6MjA3MjgyOTE2Mn0.GB-HMHWn7xy5uoXpHhTv8TBO6CNl3a877K5DBIH7ekE'
);

export default function RelationshipsVisualizationPage() {
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [sankeyData, setSankeyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ distributors: 0, suppliers: 0, brands: 0 });
  
  // Filter options and selections
  const [availableDistributors, setAvailableDistributors] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Fetch states on mount
  useEffect(() => {
    async function fetchStates() {
      const { data, error } = await supabase
        .from('core_states')
        .select('state_id, state_name, state_code')
        .order('state_name');
      
      if (error) {
        console.error('Error fetching states:', error);
      } else {
        setStates(data || []);
      }
    }
    fetchStates();
  }, []);

  // Fetch available distributors when state changes
  useEffect(() => {
    if (!selectedState) {
      setAvailableDistributors([]);
      setSelectedDistributor(null);
      return;
    }

    async function fetchDistributors() {
      const { data, error } = await supabase
        .from('distributor_supplier_state')
        .select(`
          distributor_id,
          core_distributors(distributor_name)
        `)
        .eq('state_id', selectedState);

      if (error) {
        console.error('Error fetching distributors:', error);
        return;
      }

      // Get unique distributors
      const uniqueDistributors = [];
      const seen = new Set();
      data?.forEach(item => {
        if (!seen.has(item.distributor_id)) {
          seen.add(item.distributor_id);
          uniqueDistributors.push({
            distributor_id: item.distributor_id,
            distributor_name: item.core_distributors.distributor_name
          });
        }
      });

      uniqueDistributors.sort((a, b) => 
        a.distributor_name.localeCompare(b.distributor_name)
      );

      setAvailableDistributors(uniqueDistributors);
      setSelectedDistributor(null);
    }

    fetchDistributors();
  }, [selectedState]);

  // Fetch available suppliers when state changes
  useEffect(() => {
    if (!selectedState) {
      setAvailableSuppliers([]);
      setSelectedSupplier(null);
      return;
    }

    async function fetchSuppliers() {
      // Get suppliers from distributor_supplier_state for this state
      const { data, error } = await supabase
        .from('distributor_supplier_state')
        .select(`
          supplier_id,
          core_suppliers(supplier_name)
        `)
        .eq('state_id', selectedState);

      if (error) {
        console.error('Error fetching suppliers:', error);
        return;
      }

      // Get unique suppliers
      const uniqueSuppliers = [];
      const seen = new Set();
      data?.forEach(item => {
        if (!seen.has(item.supplier_id)) {
          seen.add(item.supplier_id);
          uniqueSuppliers.push({
            supplier_id: item.supplier_id,
            supplier_name: item.core_suppliers.supplier_name
          });
        }
      });

      uniqueSuppliers.sort((a, b) => 
        a.supplier_name.localeCompare(b.supplier_name)
      );

      setAvailableSuppliers(uniqueSuppliers);
      setSelectedSupplier(null);
    }

    fetchSuppliers();
  }, [selectedState]);

  // Fetch and build Sankey data when state or filters change
  useEffect(() => {
    if (!selectedState) {
      setSankeyData(null);
      return;
    }

    async function buildSankeyData() {
      setLoading(true);
      try {
        // 1. Get distributor-supplier relationships for this state
        console.log('Selected state ID:', selectedState);
        console.log('Selected distributor:', selectedDistributor);
        console.log('Selected supplier:', selectedSupplier);
        
        // Test basic Supabase connection first
        console.log('Testing Supabase connection...');
        const { data: testData, error: testError } = await supabase
          .from('core_states')
          .select('state_id, state_name')
          .limit(1);
        
        if (testError) {
          console.error('Supabase connection test failed:', testError);
        } else {
          console.log('Supabase connection test successful:', testData);
        }
        
        // First try without joins to see if basic query works
        let distSupplierQuery = supabase
          .from('distributor_supplier_state')
          .select('*')
          .eq('state_id', selectedState);

        // Apply distributor filter if selected
        if (selectedDistributor) {
          distSupplierQuery = distSupplierQuery.eq('distributor_id', selectedDistributor);
        }

        // Apply supplier filter if selected
        if (selectedSupplier) {
          distSupplierQuery = distSupplierQuery.eq('supplier_id', selectedSupplier);
        }

        const { data: distSuppliers, error: dsError } = await distSupplierQuery;

        if (dsError) {
          console.error('Error fetching distributor-supplier relationships:', dsError);
          console.error('Full error details:', JSON.stringify(dsError, null, 2));
          throw dsError;
        }

        console.log('Distributor-Supplier relationships:', distSuppliers?.length);
        console.log('Raw distributor-supplier data:', distSuppliers);

        if (!distSuppliers || distSuppliers.length === 0) {
          setSankeyData({ nodes: [], links: [] });
          setStats({ distributors: 0, suppliers: 0, brands: 0 });
          return;
        }

        // Extract unique supplier IDs
        const supplierIds = [...new Set(distSuppliers.map(ds => ds.supplier_id))];
        
        // 2. Get supplier-brand relationships for these suppliers
        const { data: supplierBrands, error: sbError } = await supabase
          .from('brand_supplier')
          .select(`
            supplier_id,
            brand_id,
            core_brands(brand_name)
          `)
          .in('supplier_id', supplierIds);

        if (sbError) {
          console.error('Error fetching supplier-brand relationships:', sbError);
          throw sbError;
        }

        console.log('Supplier-Brand relationships:', supplierBrands?.length);
        console.log('Raw supplier-brand data:', supplierBrands);

        // Build nodes and links
        const nodes = new Set();
        const links = [];

        // Track unique entities
        const distributorSet = new Set();
        const supplierSet = new Set();
        const brandSet = new Set();

        // Create distributor -> supplier links
        distSuppliers.forEach(ds => {
          const distId = `dist_${ds.distributor_id}`;
          const distName = ds.core_distributors.distributor_name;
          const suppId = `supp_${ds.supplier_id}`;
          const suppName = ds.core_suppliers.supplier_name;

          nodes.add(JSON.stringify({ id: distId, label: distName, type: 'distributor' }));
          nodes.add(JSON.stringify({ id: suppId, label: suppName, type: 'supplier' }));
          
          distributorSet.add(ds.distributor_id);
          supplierSet.add(ds.supplier_id);

          // Add link from distributor to supplier
          links.push({
            source: distId,
            target: suppId,
            value: 1
          });
        });

        // Create supplier -> brand links
        supplierBrands?.forEach(sb => {
          const suppId = `supp_${sb.supplier_id}`;
          const brandId = `brand_${sb.brand_id}`;
          const brandName = sb.core_brands.brand_name;

          nodes.add(JSON.stringify({ id: brandId, label: brandName, type: 'brand' }));
          
          brandSet.add(sb.brand_id);

          // Add link from supplier to brand
          links.push({
            source: suppId,
            target: brandId,
            value: 1
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
  }, [selectedState, selectedDistributor, selectedSupplier]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Relationship Visualization</h1>
      <p style={{ color: '#64748b', marginTop: 8, marginBottom: 32 }}>
        Visualize distributor → supplier → brand relationships by state
      </p>

      {/* Filters */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* State Selector */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Select State:
            </label>
            <select
              value={selectedState || ''}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistributor(null);
                setSelectedSupplier(null);
              }}
              style={{
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                width: '100%',
                background: 'white'
              }}
            >
              <option value="">-- Choose a state --</option>
              {states.map(s => (
                <option key={s.state_id} value={s.state_id}>
                  {s.state_name} ({s.state_code})
                </option>
              ))}
            </select>
          </div>

          {/* Distributor Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Filter by Distributor (Optional):
            </label>
            <select
              value={selectedDistributor || ''}
              onChange={(e) => setSelectedDistributor(e.target.value || null)}
              disabled={!selectedState || availableDistributors.length === 0}
              style={{
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                width: '100%',
                background: 'white',
                opacity: !selectedState || availableDistributors.length === 0 ? 0.5 : 1,
                cursor: !selectedState || availableDistributors.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">-- All distributors --</option>
              {availableDistributors.map(d => (
                <option key={d.distributor_id} value={d.distributor_id}>
                  {d.distributor_name}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Filter by Supplier (Optional):
            </label>
            <select
              value={selectedSupplier || ''}
              onChange={(e) => setSelectedSupplier(e.target.value || null)}
              disabled={!selectedState || availableSuppliers.length === 0}
              style={{
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                width: '100%',
                background: 'white',
                opacity: !selectedState || availableSuppliers.length === 0 ? 0.5 : 1,
                cursor: !selectedState || availableSuppliers.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">-- All suppliers --</option>
              {availableSuppliers.map(s => (
                <option key={s.supplier_id} value={s.supplier_id}>
                  {s.supplier_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedDistributor || selectedSupplier) && (
          <div style={{ marginTop: 16, padding: 12, background: '#f1f5f9', borderRadius: 6, fontSize: 13 }}>
            <strong>Active Filters:</strong>
            {selectedDistributor && (
              <span style={{ marginLeft: 8, padding: '4px 8px', background: '#e0e7ff', borderRadius: 4 }}>
                Distributor: {availableDistributors.find(d => d.distributor_id === selectedDistributor)?.distributor_name}
                <button
                  onClick={() => setSelectedDistributor(null)}
                  style={{
                    marginLeft: 6,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    color: '#6366f1'
                  }}
                >
                  ✕
                </button>
              </span>
            )}
            {selectedSupplier && (
              <span style={{ marginLeft: 8, padding: '4px 8px', background: '#fef3c7', borderRadius: 4 }}>
                Supplier: {availableSuppliers.find(s => s.supplier_id === selectedSupplier)?.supplier_name}
                <button
                  onClick={() => setSelectedSupplier(null)}
                  style={{
                    marginLeft: 6,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    color: '#f59e0b'
                  }}
                >
                  ✕
                </button>
              </span>
            )}
          </div>
        )}
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

