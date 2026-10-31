import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Products from "./pages/Products";
import Plans from "./pages/Plans";
import Subscriptions from "./pages/Subscriptions";
import Invoices from "./pages/Invoices";
import Payments from "./pages/Payments";
import Taxes from "./pages/Taxes";
import Discounts from "./pages/Discounts";
import Staff from "./pages/Staff";
import Portal from "./pages/Portal";
import { getToken } from "./api";

const Guard = ({ children, roles }: { children: JSX.Element; roles: string[] }) =>
  getToken() && roles.includes(localStorage.getItem("role") ?? "") ? children : <Navigate to="/login" />;

const staff = ["ADMIN", "STAFF"];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Member 1: Products, Plans, Customers */}
      <Route path="/products" element={<Guard roles={staff}><Products /></Guard>} />
      <Route path="/plans" element={<Guard roles={staff}><Plans /></Guard>} />
      <Route path="/customers" element={<Guard roles={staff}><Customers /></Guard>} />

      {/* Member 2: Subscriptions, Invoices, Taxes, Discounts */}
      <Route path="/subscriptions" element={<Guard roles={staff}><Subscriptions /></Guard>} />
      <Route path="/invoices" element={<Guard roles={staff}><Invoices /></Guard>} />
      <Route path="/taxes" element={<Guard roles={["ADMIN"]}><Taxes /></Guard>} />
      <Route path="/discounts" element={<Guard roles={["ADMIN"]}><Discounts /></Guard>} />

      {/* Member 3: Dashboard, Payments, Portal, Staff */}
      <Route path="/dashboard" element={<Guard roles={staff}><Dashboard /></Guard>} />
      <Route path="/payments" element={<Guard roles={staff}><Payments /></Guard>} />
      <Route path="/staff" element={<Guard roles={["ADMIN"]}><Staff /></Guard>} />
      <Route path="/portal" element={<Guard roles={["CUSTOMER"]}><Portal /></Guard>} />
      <Route path="/portal/*" element={<Guard roles={["CUSTOMER"]}><Portal /></Guard>} />

      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}
