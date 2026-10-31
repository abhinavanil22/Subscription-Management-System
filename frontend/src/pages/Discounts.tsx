import { useEffect, useState } from "react";
import { api } from "../api";
import Layout from "../components/Layout";

interface Discount {
  id: string;
  name: string;
  type: "FIXED" | "PERCENTAGE";
  value: number;
  scope: "PRODUCT" | "SUBSCRIPTION";
  minPurchase?: number | null;
  minQuantity?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  startDate: string;
  endDate?: string | null;
}

export default function Discounts() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form
  const [name, setName] = useState("");
  const [type, setType] = useState<"FIXED" | "PERCENTAGE">("PERCENTAGE");
  const [value, setValue] = useState<number>(10);
  const [scope, setScope] = useState<"PRODUCT" | "SUBSCRIPTION">("SUBSCRIPTION");
  const [minPurchase, setMinPurchase] = useState<number>(0);
  const [usageLimit, setUsageLimit] = useState<number>(100);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  async function loadDiscounts() {
    try {
      setLoading(true);
      const data = await api<Discount[]>("/discounts");
      setDiscounts(data);
    } catch (e: any) {
      setMessage({ text: e.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDiscounts();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/discounts", {
        method: "POST",
        body: {
          name,
          type,
          value: Number(value),
          scope,
          minPurchase: minPurchase > 0 ? Number(minPurchase) : null,
          usageLimit: usageLimit > 0 ? Number(usageLimit) : null,
          startDate,
        },
      });
      setShowModal(false);
      setName("");
      setMessage({ text: "Discount coupon created successfully", type: "success" });
      loadDiscounts();
    } catch (e: any) {
      setMessage({ text: e.message, type: "error" });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this discount?")) return;
    try {
      await api(`/discounts/${id}`, { method: "DELETE" });
      setMessage({ text: "Discount deleted", type: "success" });
      loadDiscounts();
    } catch (e: any) {
      setMessage({ text: e.message, type: "error" });
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Discounts & Coupons</h1>
          <p className="page-subtitle">Configure percentage and fixed price promotional rules</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Create Discount
        </button>
      </div>

      {message && <div className={`toast toast-${message.type}`}>{message.text}</div>}

      <div className="card">
        <div className="table-wrapper">
          {loading ? (
            <div className="empty-state">Loading discounts...</div>
          ) : discounts.length === 0 ? (
            <div className="empty-state">No active discount rules found.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Coupon / Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Scope</th>
                  <th>Min Purchase</th>
                  <th>Usage (Used / Limit)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td>
                      <span className="badge" style={{ background: "#f1f5f9", color: "#334155" }}>
                        {d.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {d.type === "PERCENTAGE" ? `${d.value}%` : `₹${d.value}`}
                    </td>
                    <td>{d.scope}</td>
                    <td>{d.minPurchase ? `₹${d.minPurchase}` : "None"}</td>
                    <td>
                      {d.usedCount} / {d.usageLimit || "∞"}
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Discount Code</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Coupon Code / Promo Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WELCOME10, SUMMER500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group">
                    <label>Discount Type</label>
                    <select value={type} onChange={(e) => setType(e.target.value as any)}>
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED">Fixed Amount (₹)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Value ({type === "PERCENTAGE" ? "%" : "₹"}) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      min={1}
                      max={type === "PERCENTAGE" ? 100 : undefined}
                      value={value}
                      onChange={(e) => setValue(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group">
                    <label>Scope</label>
                    <select value={scope} onChange={(e) => setScope(e.target.value as any)}>
                      <option value="SUBSCRIPTION">Whole Subscription</option>
                      <option value="PRODUCT">Specific Product</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Min Purchase Amount (₹)</label>
                    <input
                      type="number"
                      value={minPurchase}
                      onChange={(e) => setMinPurchase(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group">
                    <label>Usage Limit (Max Claims)</label>
                    <input
                      type="number"
                      value={usageLimit}
                      onChange={(e) => setUsageLimit(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Discount</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
