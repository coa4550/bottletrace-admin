'use client';
export function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
      <span>{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
      />
    </label>
  );
}
export function Button({ children, onClick, variant = 'primary' }) {
  const styles = {
    primary: { background: '#0ea5e9', color: 'white' },
    danger: { background: '#ef4444', color: 'white' },
    ghost: { background: 'transparent', color: '#0f172a' }
  };
  return (
    <button
      onClick={onClick}
      style={{
        ...styles[variant],
        padding: '8px 12px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  );
}
