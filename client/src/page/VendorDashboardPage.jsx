import { useEffect, useState } from "react";
import VendorAppbar, { VendorTopbarActions } from "./VendorAppbar";
import { vendorPageCopy } from "./VendorDashboardData";
import VendorDashboardHomePage from "./VendorDashboardHomePage";
import VendorQrCodePage from "./VendorQrCodePage";
import VendorSettingsPage from "./VendorSettingsPage";
import VendorSidebar from "./VendorSidebar";
import VendorTransactionsPage from "./VendorTransactionsPage";
import { getProfile } from "../api/auth";

const getStoredVendor = () => {
  try {
    const user = JSON.parse(localStorage.getItem("cpacUser") || "{}");
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
  const [activeView, setActiveView] = useState("dashboard");
  const [vendor, setVendor] = useState(getStoredVendor);

  useEffect(() => {
    const token = localStorage.getItem("cpacToken");
    if (!token) return;
    getProfile(token)
      .then((data) => {
        if (data.success && data.user) {
          const safeUser = { ...data.user };
          delete safeUser.password;
          localStorage.setItem("cpacUser", JSON.stringify(safeUser));
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
    localStorage.removeItem("cpacToken");
    localStorage.removeItem("cpacUserType");
    localStorage.removeItem("cpacUser");
    setPage("login");
  };

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
        <VendorTopbarActions vendor={vendor} onLogout={handleExit} />
      </header>

      <div className="vendor-shell">
        <VendorSidebar
          activeView={activeView}
          onChangeView={setActiveView}
          onLogout={handleExit}
        />

        <main className="vendor-content">
          {activeView === "dashboard" && (
            <VendorDashboardHomePage vendor={vendor} onShowTransactions={() => setActiveView("transactions")} />
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
