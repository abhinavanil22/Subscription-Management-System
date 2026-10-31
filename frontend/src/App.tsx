import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Placeholder from "./pages/Placeholder";
import { getToken } from "./api";
const Guard = ({ children, roles }: { children: JSX.Element; roles: string[] }) =>
  getToken() && roles.includes(localStorage.getItem("role") ?? "") ? children : <Navigate to="/login" />;
const staff = ["ADMIN", "STAFF"];
// Each member adds routes ONLY under their own block below.
export default function App() {
  return (<Routes>
    <Route path="/login" element={<Login />} />
    {/* Member 1 */}
    <Route path="/products" element={<Guard roles={staff}><Placeholder title="Products" owner="M1" /></Guard>} />
    <Route path="/plans" element={<Guard roles={staff}><Placeholder title="Plans" owner="M1" /></Guard>} />
    {/* Member 2 */}
    <Route path="/subscriptions" element={<Guard roles={staff}><Placeholder title="Subscriptions" owner="M2" /></Guard>} />
    <Route path="/invoices" element={<Guard roles={staff}><Placeholder title="Invoices" owner="M2" /></Guard>} />
    {/* Member 3 */}
    <Route path="/dashboard" element={<Guard roles={staff}><Placeholder title="Dashboard" owner="M3" /></Guard>} />
    <Route path="/payments" element={<Guard roles={staff}><Placeholder title="Payments" owner="M3" /></Guard>} />
    <Route path="/portal" element={<Guard roles={["CUSTOMER"]}><Placeholder title="My Portal" owner="M3" /></Guard>} />
    <Route path="*" element={<Navigate to="/login" />} />
  </Routes>);
}
