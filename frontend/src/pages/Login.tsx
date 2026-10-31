import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try {
      const d = await api<{ token: string; user: { role: string } }>("/auth/login", { method: "POST", body: { email, password } });
      localStorage.setItem("token", d.token); localStorage.setItem("role", d.user.role);
      nav(d.user.role === "CUSTOMER" ? "/portal" : "/dashboard");
    } catch (e: any) { setErr(e.message); }
  }
  return (<form onSubmit={submit} style={{ maxWidth: 360, margin: "10vh auto", display: "grid", gap: 8, padding: 16 }}>
    <h2>Brightloop Login</h2>
    <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
    <button>Login</button>{err && <p style={{ color: "crimson" }}>{err}</p>}
    {/* TODO(M1): register + forgot/reset password pages */}
  </form>);
}
