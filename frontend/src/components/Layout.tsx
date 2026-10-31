import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuth, getRole, getUserEmail } from "../api";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const role = getRole();
  const email = getUserEmail();

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  const isCustomer = role === "CUSTOMER";
  const isAdmin = role === "ADMIN";

  const staffNav = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/customers", label: "Customers" },
    { to: "/products", label: "Products" },
    { to: "/plans", label: "Plans" },
    { to: "/subscriptions", label: "Subscriptions" },
    { to: "/invoices", label: "Invoices" },
    { to: "/payments", label: "Payments" },
    ...(isAdmin
      ? [
          { to: "/taxes", label: "Taxes" },
          { to: "/discounts", label: "Discounts" },
          { to: "/staff", label: "Staff" },
        ]
      : []),
  ];

  const customerNav = [
    { to: "/portal", label: "My Subscriptions" },
    { to: "/portal/invoices", label: "My Invoices" },
    { to: "/portal/payments", label: "My Payments" },
  ];

  const links = isCustomer ? customerNav : staffNav;

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <span>Brightloop</span>
          <span className="brand-badge">{role || "App"}</span>
        </div>

        <ul className="nav-links">
          {links.map((item) => (
            <li key={item.to} className="nav-item">
              <Link
                to={item.to}
                className={location.pathname === item.to ? "active" : ""}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="user-profile">
          <div className="user-info">
            <span className="user-email" title={email}>{email}</span>
            <span className="user-role">{role?.toLowerCase()}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn" title="Sign out">
            Exit
          </button>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
