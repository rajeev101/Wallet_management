import { Icon } from "./VendorIcon";

function VendorSidebar({ activeView, onChangeView, onLogout }) {
  return (
    <aside className="vendor-sidebar">
      <div className="vendor-brand">
        <span className="vendor-brand-icon">
          <Icon type="wallet" />
        </span>
        <div>
          <strong>Campus Wallet</strong>
          <span>Vendor Panel</span>
        </div>
        <button type="button" aria-label="Collapse sidebar">
          <Icon type="chevronLeft" />
        </button>
      </div>

      <nav className="vendor-nav" aria-label="Vendor dashboard navigation">
        <button
          className={activeView === "dashboard" ? "active" : ""}
          type="button"
          onClick={() => onChangeView("dashboard")}
        >
          <Icon type="dashboard" />
          Dashboard
        </button>
        <button
          className={activeView === "qr" ? "active" : ""}
          type="button"
          onClick={() => onChangeView("qr")}
        >
          <Icon type="qr" />
          QR Code
        </button>
        <button
          className={activeView === "transactions" ? "active" : ""}
          type="button"
          onClick={() => onChangeView("transactions")}
        >
          <Icon type="swap" />
          Transactions
        </button>
        <button
          className={activeView === "settings" ? "active" : ""}
          type="button"
          onClick={() => onChangeView("settings")}
        >
          <Icon type="user" />
          Profile
        </button>
      </nav>

      <button className="vendor-logout" type="button" onClick={onLogout}>
        <Icon type="logout" />
        Logout
      </button>
    </aside>
  );
}

export default VendorSidebar;
