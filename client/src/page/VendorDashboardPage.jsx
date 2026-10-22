import { useEffect, useState } from "react";
import VendorAppbar, { VendorTopbarActions } from "./VendorAppbar";
import { vendorPageCopy } from "./VendorDashboardData";
import VendorDashboardHomePage from "./VendorDashboardHomePage";
import VendorQrCodePage from "./VendorQrCodePage";
import VendorSettingsPage from "./VendorSettingsPage";
import VendorSidebar from "./VendorSidebar";
import VendorTransactionsPage from "./VendorTransactionsPage";
import { getProfile } from "../api/auth";

const VENDOR_VIEWS = ["dashboard", "qr", "transactions", "settings"];

const getStoredVendor = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem("cpacUser") || "{}");
    return {
      id: user._id || user.id || "",
      name: user.name || "Campus Cafe",
      email: user.email || "vendor@campus.edu",
      phone: user.phone || "",
      profilePicture: user.profilePicture || "",
      accountType: user.accountType || "vendor",
      walletBalance: user.walletBalance || 0,
    };
  } catch {
    return {
      id: "",
      name: "Campus Cafe",
      email: "vendor@campus.edu",
      phone: "",
      profilePicture: "",
      accountType: "vendor",
      walletBalance: 0,
    };
  }
};

function VendorDashboardPage({ setPage }) {
  const [activeView, setActiveView] = useState(() =>
    VENDOR_VIEWS.includes(window.history.state?.vendorView)
      ? window.history.state.vendorView
      : "dashboard"
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [vendor, setVendor] = useState(getStoredVendor);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    const handleResize = () => {
      if (!window.matchMedia("(max-width: 900px)").matches) setMobileNavOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const token = sessionStorage.getItem("cpacToken");
    if (!token) return;
    getProfile(token)
      .then((data) => {
        if (data.success && data.user) {
          const safeUser = { ...data.user };
          delete safeUser.password;
          sessionStorage.setItem("cpacUser", JSON.stringify(safeUser));
          setVendor({
            id: safeUser._id || safeUser.id || "",
            name: safeUser.name || "",
            email: safeUser.email || "",
            phone: safeUser.phone || "",
            profilePicture: safeUser.profilePicture || "",
            accountType: safeUser.accountType || "vendor",
            walletBalance: safeUser.walletBalance || 0,
          });
        }
      })
      .catch((err) => console.error("Failed to fetch profile in vendor dashboard:", err));
  }, [activeView]);


  const handleExit = () => {
    sessionStorage.removeItem("cpacToken");
    sessionStorage.removeItem("cpacUserType");
    sessionStorage.removeItem("cpacUser");
    setPage("login");
  };

  const changeView = (view) => {
    if (!VENDOR_VIEWS.includes(view) || view === activeView) {
      setMobileNavOpen(false);
      return;
    }
    window.history.pushState({ vendorView: view }, "", window.location.href);
    setActiveView(view);
    setMobileNavOpen(false);
  };

  useEffect(() => {
    const handleVendorViewPopState = (event) => {
      const view = event.state?.vendorView;
      setActiveView(VENDOR_VIEWS.includes(view) ? view : "dashboard");
      setMobileNavOpen(false);
    };

    window.addEventListener("popstate", handleVendorViewPopState);
    return () => window.removeEventListener("popstate", handleVendorViewPopState);
  }, []);

  const pageSubtitle = vendorPageCopy[activeView]?.[1] || vendorPageCopy.dashboard[1];
  const topbarTitle =
    activeView === "dashboard"
      ? "Vendor Dashboard"
      : activeView === "qr"
        ? "QR Code"
        : activeView === "transactions"
          ? "Transaction"
          : activeView === "settings"
            ? "Profile"
            : "Vendor Dashboard";

  return (
    <div className="vendor-dashboard-page">
      <header className="vendor-page-topbar">
        <div className="vendor-page-topbar-title">
          <strong>{topbarTitle}</strong>
          <span>{pageSubtitle}</span>
        </div>
        <button
          className="mobile-nav-toggle"
          type="button"
          aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileNavOpen}
          aria-controls="vendor-dashboard-sidebar"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
          <span>Menu</span>
        </button>
        <VendorTopbarActions vendor={vendor} onLogout={handleExit} />
      </header>

      <div className="vendor-shell">
        {mobileNavOpen && (
          <button
            className="mobile-sidebar-backdrop"
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <VendorSidebar
          activeView={activeView}
          mobileOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          onChangeView={changeView}
          onLogout={handleExit}
        />

        <main className="vendor-content">
          {activeView === "dashboard" && (
            <VendorDashboardHomePage vendor={vendor} onShowTransactions={() => changeView("transactions")} />
          )}
          {activeView === "qr" && <VendorQrCodePage vendor={vendor} />}
          {activeView === "transactions" && <VendorTransactionsPage vendor={vendor} />}
          {activeView === "settings" && (
            <VendorSettingsPage vendor={vendor} onProfileChange={setVendor} />
          )}
        </main>
      </div>
    </div>
  );
}

export default VendorDashboardPage;
