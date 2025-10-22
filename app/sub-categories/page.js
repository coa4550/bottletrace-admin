'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import SearchInput from '@/components/SearchInput';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SubCategoriesPage() {
  const [subCategories, setSubCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colWidths, setColWidths] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('subCategoryColWidths');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [subCategoriesRes, categoriesRes] = await Promise.all([
          supabase
            .from('sub_categories')
            .select('*, categories(category_name)')
            .order('sub_category_name'),
          supabase
            .from('categories')
            .select('category_id, category_name')
            .order('category_name')
        ]);

        if (subCategoriesRes.error) throw subCategoriesRes.error;
        if (categoriesRes.error) throw categoriesRes.error;

        // Flatten the nested category data
        const enriched = subCategoriesRes.data.map(sc => ({
          ...sc,
          category_name: sc.categories?.category_name || '—'
        }));

        setSubCategories(enriched || []);
        setAllCategories(categoriesRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const startResize = (e, key) => {
    const startX = e.clientX;
    const startWidth = colWidths[key] || 150;

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(60, startWidth + moveEvent.clientX - startX);
      setColWidths((prev) => {
        const updated = { ...prev, [key]: newWidth };
        localStorage.setItem('subCategoryColWidths', JSON.stringify(updated));
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

  const handleEdit = async (subCategoryId, field, newValue) => {
    try {
      const { error } = await supabase
        .from('sub_categories')
        .update({ [field]: newValue })
        .eq('sub_category_id', subCategoryId);

      if (error) throw error;
      
      // Update local state
      setSubCategories((prev) =>
        prev.map((sc) => {
          if (sc.sub_category_id === subCategoryId) {
            const updated = { ...sc, [field]: newValue };
            // If updating category_id, also update category_name for display
            if (field === 'category_id') {
              const selectedCategory = allCategories.find(c => c.category_id === newValue);
              updated.category_name = selectedCategory?.category_name || '—';
            }
            return updated;
          }
          return sc;
        })
      );
    } catch (err) {
      console.error('Update error:', err.message);
      alert('Failed to update Supabase.');
    }
  };

  const columns = [
    { key: 'sub_category_name', label: 'Sub-Category Name', editable: true },
    { key: 'category_name', label: 'Parent Category', editable: true, editHandler: 'category' },
    { key: 'actions', label: 'Actions' },
  ];

  // Filter sub-categories based on search term
  const filteredSubCategories = subCategories.filter(subCategory => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      subCategory.sub_category_name?.toLowerCase().includes(searchLower) ||
      subCategory.category_name?.toLowerCase().includes(searchLower)
    );
  });

  const sortedSubCategories = [...filteredSubCategories].sort((a, b) => {
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

  const handleDeleteSubCategory = async (subCategoryId, subCategoryName) => {
    if (!confirm(`Are you sure you want to delete the sub-category "${subCategoryName}"?\n\nThis will permanently delete:\n• The sub-category record\n• All brand associations with this sub-category\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      // Delete brand-subcategory relationships first
      const { error: relError } = await supabase
        .from('brand_sub_categories')
        .delete()
        .eq('sub_category_id', subCategoryId);

      if (relError) throw relError;

      // Delete the sub-category itself
      const { error: deleteError } = await supabase
        .from('sub_categories')
        .delete()
        .eq('sub_category_id', subCategoryId);

      if (deleteError) throw deleteError;

      // Remove from local state
      setSubCategories(prev => prev.filter(sc => sc.sub_category_id !== subCategoryId));
      
      alert(`Sub-category "${subCategoryName}" has been successfully deleted.`);
    } catch (err) {
      console.error('Delete sub-category error:', err.message);
      alert('Failed to delete sub-category: ' + err.message);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 16 }}>Sub-Categories ({subCategories.length})</h1>
      <div style={{ marginBottom: 16 }}>
        <SearchInput 
          placeholder="Search sub-categories..." 
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
            {sortedSubCategories.map((sc) => (
              <tr key={sc.sub_category_id}>
                {columns.map((col) => {
                  const value = sc[col.key];
                  const editable = col.editable;

                  // Special rendering for actions column
                  if (col.key === 'actions') {
                    return (
                      <td key={col.key} style={cellStyle}>
                        <button
                          onClick={() => handleDeleteSubCategory(sc.sub_category_id, sc.sub_category_name)}
                          style={{
                            padding: '4px 8px',
                            fontSize: 12,
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: 500
                          }}
                          title="Delete sub-category"
                        >
                          Delete
                        </button>
                      </td>
                    );
                  }

                  if (editable) {
                    // Use dropdown for category selection
                    if (col.editHandler === 'category') {
                      return (
                        <td key={col.key} style={cellStyle}>
                          <CategoryDropdown
                            currentCategoryId={sc.category_id}
                            currentCategoryName={value}
                            categories={allCategories}
                            onChange={(categoryId) => handleEdit(sc.sub_category_id, 'category_id', categoryId)}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={col.key} style={cellStyle}>
                        <EditableCell
                          value={value}
                          onChange={(val) => handleEdit(sc.sub_category_id, col.key, val)}
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

const cellStyle = {
  padding: '8px 12px',
  borderBottom: '1px solid #f1f5f9',
  whiteSpace: 'nowrap',
  maxWidth: 400,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function CategoryDropdown({ currentCategoryId, currentCategoryName, categories, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(currentCategoryId);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);

  useEffect(() => {
    setSelectedCategoryId(currentCategoryId);
  }, [currentCategoryId]);

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
    onChange(selectedCategoryId);
    setIsOpen(false);
  };

  const displayValue = currentCategoryName || '—';

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
        title="Click to edit category"
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
              Select Category ({categories.length} available)
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
                  name="category"
                  checked={!selectedCategoryId}
                  onChange={() => setSelectedCategoryId(null)}
                  style={{ marginRight: 8 }}
                />
                <span style={{ color: '#94a3b8' }}>No Category</span>
              </label>
              {categories.map(category => (
                <label
                  key={category.category_id}
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
                    name="category"
                    checked={selectedCategoryId === category.category_id}
                    onChange={() => setSelectedCategoryId(category.category_id)}
                    style={{ marginRight: 8 }}
                  />
                  {category.category_name}
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

