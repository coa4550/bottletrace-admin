export default function Page() {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Welcome to BottleTrace Admin</h1>
      <ul>
        <li>Manage <b>Brands</b>, <b>Distributors</b> & <b>Suppliers</b> easily.</li>
        <li>Control <b>Brand ↔ Supplier ↔ State</b> mappings.</li>
        <li>Control <b>Brand ↔ Distributor ↔ State</b> mappings.</li>
        <li>Bulk upload verified relationships via CSV.</li>
      </ul>
    </div>
  );
}
