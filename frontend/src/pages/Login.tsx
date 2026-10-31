import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const d = await api<{ token: string; user: { role: string; email: string } }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      localStorage.setItem("token", d.token);
      localStorage.setItem("role", d.user.role);
      localStorage.setItem("email", d.user.email);
      nav(d.user.role === "CUSTOMER" ? "/portal" : "/dashboard");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function fillCreds(role: "ADMIN" | "STAFF" | "CUSTOMER") {
    if (role === "ADMIN") {
      setEmail("admin@brightloop.test");
      setPassword("Admin@12345");
    } else if (role === "STAFF") {
      setEmail("staff@brightloop.test");
      setPassword("Staff@12345");
    } else {
      setEmail("customer@brightloop.test");
      setPassword("Customer@12345");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: "1.75rem", color: "var(--primary)", fontWeight: 800 }}>Brightloop</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Subscription Management & Invoicing System
          </p>
        </div>

        {err && <div className="toast toast-error">{err}</div>}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Email Address</label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ justifyContent: "center", padding: 10 }} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Quick Demo Accounts
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillCreds("ADMIN")}>
              Admin
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillCreds("STAFF")}>
              Staff
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillCreds("CUSTOMER")}>
              Customer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
