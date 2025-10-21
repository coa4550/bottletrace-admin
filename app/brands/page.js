'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import SearchInput from '@/components/SearchInput';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allCategories, setAllCategories] = useState([]);
  const [allSubCategories, setAllSubCategories] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [colWidths, setColWidths] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('brandColWidths');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all available categories, sub-categories, and suppliers
  useEffect(() => {
    async function fetchCategoriesSubCategoriesAndSuppliers() {
      try {
        const [categoriesRes, subCategoriesRes, suppliersRes] = await Promise.all([
          supabase.from('categories').select('category_id, category_name').order('category_name'),
          supabase.from('sub_categories').select('sub_category_id, sub_category_name').order('sub_category_name'),
          supabase.from('core_suppliers').select('supplier_id, supplier_name').order('supplier_name')
        ]);

        if (categoriesRes.error) throw categoriesRes.error;
        if (subCategoriesRes.error) throw subCategoriesRes.error;
        if (suppliersRes.error) throw suppliersRes.error;

        setAllCategories(categoriesRes.data || []);
        setAllSubCategories(subCategoriesRes.data || []);
        setAllSuppliers(suppliersRes.data || []);
      } catch (error) {
        console.error('Error fetching categories and suppliers:', error);
      }
    }
    fetchCategoriesSubCategoriesAndSuppliers();
  }, []);

  // Extract brands fetching logic into a reusable function
  const fetchBrandsData = async () => {
      try {
        // Fetch ALL brands using pagination
        let allBrands = [];
        let start = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('core_brands')
            .select('*')
            .order('brand_name')
            .range(start, start + pageSize - 1);

          if (error) throw error;
          
          if (data && data.length > 0) {
            allBrands = [...allBrands, ...data];
            start += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Fetch ALL brand-category mappings
        let allBrandCats = [];
        start = 0;
        hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('brand_categories')
            .select('brand_id, categories(category_name)')
            .range(start, start + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allBrandCats = [...allBrandCats, ...data];
            start += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Fetch ALL brand-subcategory mappings
        let allBrandSubcats = [];
        start = 0;
        hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('brand_sub_categories')
            .select('brand_id, sub_categories(sub_category_name)')
            .range(start, start + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allBrandSubcats = [...allBrandSubcats, ...data];
            start += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Fetch ALL brand-supplier relationships for verification data and supplier info
        let allBrandSuppliers = [];
        start = 0;
        hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('brand_supplier')
            .select(`
              brand_id, 
              supplier_id, 
              is_verified, 
              last_verified_at, 
              relationship_source,
              core_suppliers(supplier_name)
            `)
            .range(start, start + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allBrandSuppliers = [...allBrandSuppliers, ...data];
            start += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        // Create lookup maps
        const catsMap = {};
        allBrandCats?.forEach(bc => {
          if (bc.categories && bc.categories.category_name) {
            if (!catsMap[bc.brand_id]) catsMap[bc.brand_id] = [];
            catsMap[bc.brand_id].push(bc.categories.category_name);
          }
        });

        const subcatsMap = {};
        allBrandSubcats?.forEach(bsc => {
          if (bsc.sub_categories && bsc.sub_categories.sub_category_name) {
            if (!subcatsMap[bsc.brand_id]) subcatsMap[bsc.brand_id] = [];
            subcatsMap[bsc.brand_id].push(bsc.sub_categories.sub_category_name);
          }
        });

        // Create verification and supplier lookup maps
        // For each brand, determine if ANY supplier relationship is verified
        // and find the most recent verification date and current supplier
        const verificationMap = {};
        const supplierMap = {};
        allBrandSuppliers?.forEach(bs => {
          if (!verificationMap[bs.brand_id]) {
            verificationMap[bs.brand_id] = {
              hasVerified: false,
              lastVerifiedAt: null
            };
          }
          
          if (bs.is_verified) {
            verificationMap[bs.brand_id].hasVerified = true;
          }
          
          if (bs.last_verified_at) {
            const verifiedDate = new Date(bs.last_verified_at);
            if (!verificationMap[bs.brand_id].lastVerifiedAt || 
                verifiedDate > new Date(verificationMap[bs.brand_id].lastVerifiedAt)) {
              verificationMap[bs.brand_id].lastVerifiedAt = bs.last_verified_at;
            }
          }

          // Store supplier information (taking the first supplier if multiple)
          if (!supplierMap[bs.brand_id]) {
            supplierMap[bs.brand_id] = {
              supplier_id: bs.supplier_id,
              supplier_name: bs.core_suppliers?.supplier_name || '',
              relationship_source: bs.relationship_source
            };
          }
        });

        // Merge data
        const enrichedBrands = allBrands.map(brand => {
          const supplierInfo = supplierMap[brand.brand_id];
          
          return {
            ...brand,
            categories: catsMap[brand.brand_id]?.join(', ') || '',
            sub_categories: subcatsMap[brand.brand_id]?.join(', ') || '',
            is_verified: verificationMap[brand.brand_id]?.hasVerified || false,
            last_verified_at: verificationMap[brand.brand_id]?.lastVerifiedAt || null,
            supplier_id: supplierInfo?.supplier_id || null,
            supplier_name: supplierInfo?.supplier_name || '',
            relationship_source: supplierInfo?.relationship_source || null
          };
        });

        setBrands(enrichedBrands);
      } catch (error) {
        console.error('Error fetching brands:', error);
      } finally {
        setLoading(false);
      }
  };

  // Fetch brands with categories and sub-categories
  useEffect(() => {
    fetchBrandsData();
  }, []);

  const startResize = (e, key) => {
    const startX = e.clientX;
    const startWidth = colWidths[key] || 150;

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(60, startWidth + moveEvent.clientX - startX);
      setColWidths((prev) => {
        const updated = { ...prev, [key]: newWidth };
        localStorage.setItem('brandColWidths', JSON.stringify(updated));
        return updated;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleEdit = async (brandId, field, newValue) => {
    try {
      const { error } = await supabase
        .from('core_brands')
        .update({ [field]: newValue })
        .eq('brand_id', brandId);

      if (error) throw error;
      setBrands((prev) =>
        prev.map((b) => (b.brand_id === brandId ? { ...b, [field]: newValue } : b))
      );
    } catch (err) {
      console.error('Update error:', err.message);
      alert('Failed to update Supabase.');
    }
  };

  const handleCategoriesEdit = async (brandId, selectedCategoryIds) => {
    try {
      // Delete existing brand-category relationships
      const { error: deleteError } = await supabase
        .from('brand_categories')
        .delete()
        .eq('brand_id', brandId);

      if (deleteError) throw deleteError;

      // Insert new relationships
      if (selectedCategoryIds.length > 0) {
        const relationships = selectedCategoryIds.map(categoryId => ({
          brand_id: brandId,
          category_id: categoryId
        }));

        const { error: insertError } = await supabase
          .from('brand_categories')
          .insert(relationships);

        if (insertError) throw insertError;
      }

      // Update local state with category names
      const categoryNames = selectedCategoryIds
        .map(id => allCategories.find(c => c.category_id === id)?.category_name)
        .filter(Boolean)
        .join(', ');

      setBrands((prev) =>
        prev.map((b) => (b.brand_id === brandId ? { ...b, categories: categoryNames } : b))
      );
    } catch (err) {
      console.error('Update categories error:', err.message);
      alert('Failed to update categories: ' + err.message);
    }
  };

  const handleSubCategoriesEdit = async (brandId, selectedSubCategoryIds) => {
    try {
      // Delete existing brand-subcategory relationships
      const { error: deleteError } = await supabase
        .from('brand_sub_categories')
        .delete()
        .eq('brand_id', brandId);

      if (deleteError) throw deleteError;

      // Insert new relationships
      if (selectedSubCategoryIds.length > 0) {
        const relationships = selectedSubCategoryIds.map(subCategoryId => ({
          brand_id: brandId,
          sub_category_id: subCategoryId
        }));

        const { error: insertError } = await supabase
          .from('brand_sub_categories')
          .insert(relationships);

        if (insertError) throw insertError;
      }

      // Update local state with sub-category names
      const subCategoryNames = selectedSubCategoryIds
        .map(id => allSubCategories.find(sc => sc.sub_category_id === id)?.sub_category_name)
        .filter(Boolean)
        .join(', ');

      setBrands((prev) =>
        prev.map((b) => (b.brand_id === brandId ? { ...b, sub_categories: subCategoryNames } : b))
      );
    } catch (err) {
      console.error('Update sub-categories error:', err.message);
      alert('Failed to update sub-categories: ' + err.message);
    }
  };

  const handleSupplierEdit = async (brandId, newSupplierId) => {
    try {
      // Delete existing brand-supplier relationships
      const { error: deleteError } = await supabase
        .from('brand_supplier')
        .delete()
        .eq('brand_id', brandId);

      if (deleteError) throw deleteError;

      // Insert new relationship if supplier is selected
      if (newSupplierId) {
        const { error: insertError } = await supabase
          .from('brand_supplier')
          .insert({
            brand_id: brandId,
            supplier_id: newSupplierId,
            is_verified: true,
            last_verified_at: new Date().toISOString(),
            relationship_source: 'admin_edit'
          });

        if (insertError) throw insertError;
      }

      // Refresh the brands data to get updated verification information
      await fetchBrandsData();
    } catch (err) {
      console.error('Update supplier error:', err.message);
      alert('Failed to update supplier: ' + err.message);
    }
  };

  const columns = [
    { key: 'brand_name', label: 'Brand Name', editable: true },
    { key: 'categories', label: 'Categories', editable: true, editHandler: 'categories' },
    { key: 'sub_categories', label: 'Sub-Categories', editable: true, editHandler: 'sub_categories' },
    { key: 'supplier_name', label: 'Supplier', editable: true, editHandler: 'supplier' },
    { key: 'is_verified', label: 'Verified' },
    { key: 'last_verified_at', label: 'Verified Date' },
    { key: 'data_source', label: 'Data Source', editable: true },
    { key: 'brand_url', label: 'Website', editable: true },
    { key: 'brand_logo_url', label: 'Logo URL', editable: true },
  ];

  // Filter brands based on search term
  const filteredBrands = brands.filter(brand => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      brand.brand_name?.toLowerCase().includes(searchLower) ||
      brand.categories?.toLowerCase().includes(searchLower) ||
      brand.sub_categories?.toLowerCase().includes(searchLower) ||
      brand.supplier_name?.toLowerCase().includes(searchLower) ||
      brand.brand_url?.toLowerCase().includes(searchLower) ||
      brand.data_source?.toLowerCase().includes(searchLower)
    );
  });

  const sortedBrands = [...filteredBrands].sort((a, b) => {
    const { key, direction } = sortConfig;
    if (!key) return 0;
    const aVal = a[key] ?? '';
    const bVal = b[key] ?? '';
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key)
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: 'asc' };
    });
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 16 }}>Brands ({brands.length})</h1>
      <div style={{ marginBottom: 16 }}>
        <SearchInput 
          placeholder="Search brands, categories, suppliers, websites..." 
          onSearch={setSearchTerm}
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            tableLayout: 'auto',
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          <thead style={{ background: '#f1f5f9' }}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: colWidths[col.key] || 150,
                    position: 'relative',
                    borderRight: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortConfig.key === col.key && (
                    <span style={{ marginLeft: 4 }}>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                  <div
                    onMouseDown={(e) => startResize(e, col.key)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      height: '100%',
                      width: '5px',
                      cursor: 'col-resize',
                      background: 'transparent',
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedBrands.map((b) => (
              <tr key={b.brand_id}>
                {columns.map((col) => {
                  const value = b[col.key];
                  const editable = col.editable;

                  // Special rendering for verified status
                  if (col.key === 'is_verified') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        {value ? (
                          <span style={{ color: '#10b981', fontWeight: 500 }}>✓ Verified</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                    );
                  }

                  // Special rendering for verified date
                  if (col.key === 'last_verified_at') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        {value ? (
                          <span>{new Date(value).toLocaleDateString()}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                    );
                  }

                  if (editable) {
                    // Use multi-select for categories and sub-categories
                    if (col.editHandler === 'categories') {
                      return (
                        <td key={col.key} style={cellStyle}>
                          <MultiSelectCell
                            currentValue={value}
                            options={allCategories}
                            optionIdKey="category_id"
                            optionLabelKey="category_name"
                            onChange={(selectedIds) => handleCategoriesEdit(b.brand_id, selectedIds)}
                          />
                        </td>
                      );
                    }
                    
                    if (col.editHandler === 'sub_categories') {
                      return (
                        <td key={col.key} style={cellStyle}>
                          <MultiSelectCell
                            currentValue={value}
                            options={allSubCategories}
                            optionIdKey="sub_category_id"
                            optionLabelKey="sub_category_name"
                            onChange={(selectedIds) => handleSubCategoriesEdit(b.brand_id, selectedIds)}
                          />
                        </td>
                      );
                    }

                    if (col.editHandler === 'supplier') {
                      return (
                        <td key={col.key} style={cellStyle}>
                          <SupplierSelectCell
                            currentSupplierId={b.supplier_id}
                            currentSupplierName={value}
                            suppliers={allSuppliers}
                            onChange={(supplierId) => handleSupplierEdit(b.brand_id, supplierId)}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={col.key} style={cellStyle}>
                        <EditableCell
                          value={value}
                          onChange={(val) => handleEdit(b.brand_id, col.key, val)}
                        />
                      </td>
                    );
                  }

                  return (
                    <td key={col.key} style={cellStyle}>
                      {value || '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SupplierSelectCell({ currentSupplierId, currentSupplierName, suppliers, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(currentSupplierId);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  useEffect(() => {
    setSelectedSupplierId(currentSupplierId);
  }, [currentSupplierId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleOpen = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Calculate position
      let top = rect.bottom + 4;
      let left = rect.left;
      
      // Adjust if dropdown would go off screen
      if (top + 300 > viewportHeight) {
        top = rect.top - 300 - 4; // Show above instead
      }
      if (left + 300 > viewportWidth) {
        left = viewportWidth - 300 - 10; // Adjust left
      }
      if (left < 10) {
        left = 10; // Minimum margin from edge
      }
      
      setDropdownPosition({ top, left });
    }
    setIsOpen(true);
  };

  const handleSave = () => {
    onChange(selectedSupplierId);
    setIsOpen(false);
  };

  const displayValue = currentSupplierName || '—';

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <div
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        style={{
          cursor: 'pointer',
          padding: '4px 8px',
          border: '1px solid transparent',
          borderRadius: 4,
          minWidth: 100,
          backgroundColor: isOpen ? '#f8fafc' : 'transparent'
        }}
        title="Click to edit supplier"
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = '#f8fafc';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {displayValue}
      </div>

      {isOpen && (
        <>
          {/* Backdrop to capture clicks outside */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
              background: 'transparent'
            }}
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div
            style={{
              position: 'fixed',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              zIndex: 9999,
              background: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: 200,
              maxWidth: 300,
              maxHeight: 300,
              overflowY: 'auto'
            }}
          >
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: 13 }}>
              Select Supplier ({suppliers.length} available)
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 14,
                  borderBottom: '1px solid #f1f5f9'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <input
                  type="radio"
                  name="supplier"
                  checked={!selectedSupplierId}
                  onChange={() => setSelectedSupplierId(null)}
                  style={{ marginRight: 8 }}
                />
                <span style={{ color: '#94a3b8' }}>No Supplier</span>
              </label>
              {suppliers.map(supplier => (
                <label
                  key={supplier.supplier_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 14,
                    ':hover': { background: '#f8fafc' }
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  <input
                    type="radio"
                    name="supplier"
                    checked={selectedSupplierId === supplier.supplier_id}
                    onChange={() => setSelectedSupplierId(supplier.supplier_id)}
                    style={{ marginRight: 8 }}
                  />
                  {supplier.supplier_name}
                </label>
              ))}
            </div>
            <div style={{ 
              padding: 8, 
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  border: 'none',
                  borderRadius: 4,
                  background: '#3b82f6',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const cellStyle = {
  padding: '8px 12px',
  borderBottom: '1px solid #f1f5f9',
  whiteSpace: 'nowrap',
  maxWidth: 400,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function EditableCell({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value || '');

  const handleBlur = () => {
    setEditing(false);
    if (temp !== value) onChange(temp);
  };

  if (editing)
    return (
      <input
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={handleBlur}
        autoFocus
        style={{
          width: '100%',
          padding: 4,
          border: '1px solid #cbd5e1',
          borderRadius: 4,
        }}
      />
    );

  return (
    <div
      onClick={() => setEditing(true)}
      style={{ cursor: 'text', minWidth: 80 }}
      title="Click to edit"
    >
      {value || '—'}
    </div>
  );
}

function MultiSelectCell({ currentValue, options, optionIdKey, optionLabelKey, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(() => {
    // Parse current value (comma-separated names) into IDs
    if (!currentValue) return [];
    const names = currentValue.split(',').map(n => n.trim());
    return options
      .filter(opt => names.includes(opt[optionLabelKey]))
      .map(opt => opt[optionIdKey]);
  });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Update selected when currentValue or options change
    if (!currentValue) {
      setSelected([]);
      return;
    }
    const names = currentValue.split(',').map(n => n.trim());
    const ids = options
      .filter(opt => names.includes(opt[optionLabelKey]))
      .map(opt => opt[optionIdKey]);
    setSelected(ids);
  }, [currentValue, options, optionIdKey, optionLabelKey]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Debug logging
  useEffect(() => {
    if (isOpen) {
      console.log('MultiSelectCell opened:', { currentValue, options, selected });
    }
  }, [isOpen, currentValue, options, selected]);

  const toggleOption = (id) => {
    const newSelected = selected.includes(id)
      ? selected.filter(sid => sid !== id)
      : [...selected, id];
    setSelected(newSelected);
  };

  const handleOpen = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Calculate position
      let top = rect.bottom + 4;
      let left = rect.left;
      
      // Adjust if dropdown would go off screen
      if (top + 300 > viewportHeight) {
        top = rect.top - 300 - 4; // Show above instead
      }
      if (left + 300 > viewportWidth) {
        left = viewportWidth - 300 - 10; // Adjust left
      }
      if (left < 10) {
        left = 10; // Minimum margin from edge
      }
      
      setDropdownPosition({ top, left });
    }
    setIsOpen(true);
  };

  const handleSave = () => {
    onChange(selected);
    setIsOpen(false);
  };

  const displayValue = currentValue || '—';

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <div
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        style={{
          cursor: 'pointer',
          padding: '4px 8px',
          border: '1px solid transparent',
          borderRadius: 4,
          minWidth: 100,
          backgroundColor: isOpen ? '#f8fafc' : 'transparent'
        }}
        title="Click to edit"
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = '#f8fafc';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {displayValue}
      </div>

      {isOpen && (
        <>
          {/* Backdrop to capture clicks outside */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
              background: 'transparent'
            }}
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div
            style={{
              position: 'fixed',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              zIndex: 9999,
              background: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: 200,
              maxWidth: 300,
              maxHeight: 300,
              overflowY: 'auto'
            }}
          >
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: 13 }}>
            Select Options ({options.length} available)
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {options.length === 0 ? (
              <div style={{ padding: '12px', color: '#94a3b8', fontSize: 14 }}>
                No options available
              </div>
            ) : (
              options.map(opt => (
              <label
                key={opt[optionIdKey]}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 14,
                  ':hover': { background: '#f8fafc' }
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt[optionIdKey])}
                  onChange={() => toggleOption(opt[optionIdKey])}
                  style={{ marginRight: 8 }}
                />
                {opt[optionLabelKey]}
              </label>
              ))
            )}
          </div>
          <div style={{ 
            padding: 8, 
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                background: 'white',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                border: 'none',
                borderRadius: 4,
                background: '#3b82f6',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Save
            </button>
          </div>
          </div>
        </>
      )}
    </div>
  );
}