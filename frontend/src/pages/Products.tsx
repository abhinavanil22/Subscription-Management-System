import { useEffect, useState } from "react";
import { api, getRole } from "../api";
import Layout from "../components/Layout";

interface Variant {
  id: string;
  productId: string;
  attribute: string;
  value: string;
  priceAdjustment: number;
}

interface Product {
  id: string;
  name: string;
  type: "SERVICE" | "GOODS";
  salesPrice: number;
  costPrice: number;
  notes?: string;
  isActive: boolean;
  variants: Variant[];
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // New product form
  const [name, setName] = useState("");
  const [type, setType] = useState<"SERVICE" | "GOODS">("SERVICE");
  const [salesPrice, setSalesPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [notes, setNotes] = useState("");

  // New variant form
  const [varAttr, setVarAttr] = useState("Edition");
  const [varVal, setVarVal] = useState("");
  const [varAdjustment, setVarAdjustment] = useState<number>(0);

  const isAdmin = getRole() === "ADMIN";

  async function loadProducts() {
    try {
      setLoading(true);
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const data = await api<Product[]>(`/products${query}`);
      setProducts(data);
    } catch (e: any) {
      setMessage({ text: e.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, [search]);

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api<Product>("/products", {
        method: "POST",
        body: { name, type, salesPrice: Number(salesPrice), costPrice: Number(costPrice), notes },
      });
      setShowAddModal(false);
      setName("");
      setNotes("");
      setSalesPrice(0);
      setCostPrice(0);
      setMessage({ text: "Product created successfully", type: "success" });
      loadProducts();
    } catch (e: any) {
      setMessage({ text: e.message, type: "error" });
    }
  }

  async function handleCreateVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!showVariantModal) return;
    try {
      await api(`/products/${showVariantModal.id}/variants`, {
        method: "POST",
        body: {
          attribute: varAttr,
          value: varVal,
          priceAdjustment: Number(varAdjustment),
        },
      });
      setShowVariantModal(null);
      setVarVal("");
      setVarAdjustment(0);
      setMessage({ text: "Variant added successfully", type: "success" });
      loadProducts();
    } catch (e: any) {
      setMessage({ text: e.message, type: "error" });
    }
  }

  async function handleDeleteVariant(productId: string, variantId: string) {
    if (!confirm("Are you sure you want to remove this variant?")) return;
    try {
      await api(`/products/${productId}/variants/${variantId}`, { method: "DELETE" });
      loadProducts();
    } catch (e: any) {
      setMessage({ text: e.message, type: "error" });
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products & Catalog</h1>
          <p className="page-subtitle">Manage subscription items, services, goods, and variant pricing</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Product
          </button>
        )}
      </div>

      {message && (
        <div className={`toast toast-${message.type}`}>{message.text}</div>
      )}

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search products by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      <div className="card">
        <div className="table-wrapper">
          {loading ? (
            <div className="empty-state">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="empty-state">No products found. Click "+ Add Product" to create one.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Base Sales Price</th>
                  <th>Cost Price</th>
                  <th>Variants & Adjustments</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {p.notes && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{p.notes}</div>}
                    </td>
                    <td>
                      <span className="badge" style={{ background: p.type === "SERVICE" ? "#e0f2fe" : "#fef3c7", color: p.type === "SERVICE" ? "#0369a1" : "#b45309" }}>
                        {p.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>₹{p.salesPrice}</td>
                    <td style={{ color: "var(--text-muted)" }}>₹{p.costPrice}</td>
                    <td>
                      {p.variants && p.variants.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {p.variants.map((v) => (
                            <span
                              key={v.id}
                              className="badge"
                              style={{ background: "#f1f5f9", color: "#334155", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              {v.attribute}: {v.value} ({v.priceAdjustment >= 0 ? `+₹${v.priceAdjustment}` : `-₹${Math.abs(v.priceAdjustment)}`} → ₹{p.salesPrice + v.priceAdjustment})
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteVariant(p.id, v.id)}
                                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "0.8rem", marginLeft: 2 }}
                                  title="Delete variant"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>None</span>
                      )}
                    </td>
                    <td>
                      {isAdmin && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setShowVariantModal(p)}
                        >
                          + Add Variant
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Product</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleCreateProduct}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Business Software"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Product Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value as any)}>
                    <option value="SERVICE">Service (SaaS, Maintenance)</option>
                    <option value="GOODS">Goods (Hardware, Equipment)</option>
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group">
                    <label>Base Sales Price (₹)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="any"
                      value={salesPrice}
                      onChange={(e) => setSalesPrice(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Cost Price (₹)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="any"
                      value={costPrice}
                      onChange={(e) => setCostPrice(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes / Description</label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes or specifications"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Variant Modal */}
      {showVariantModal && (
        <div className="modal-overlay" onClick={() => setShowVariantModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Variant for {showVariantModal.name}</h2>
              <button onClick={() => setShowVariantModal(null)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleCreateVariant}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Attribute Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Edition, RAM, Tier, Storage"
                    value={varAttr}
                    onChange={(e) => setVarAttr(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Attribute Value</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standard, Odoo, Enterprise"
                    value={varVal}
                    onChange={(e) => setVarVal(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Price Adjustment (₹)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 560 (or 0 for standard)"
                    value={varAdjustment}
                    onChange={(e) => setVarAdjustment(Number(e.target.value))}
                  />
                  <small style={{ color: "var(--text-muted)" }}>
                    Final price will be: ₹{showVariantModal.salesPrice} + ₹{varAdjustment} = ₹{showVariantModal.salesPrice + Number(varAdjustment)}
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowVariantModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
