import { useEffect, useState } from "react";
import VendorAppbar from "./VendorAppbar";
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

  const [pageTitle, pageSubtitle] = vendorPageCopy[activeView] || vendorPageCopy.dashboard;
  const appbarTitle =
    activeView === "qr"
      ? "QR Code Management"
      : activeView === "transactions"
        ? "Transactions"
        : pageTitle;

  return (
    <div className="vendor-dashboard-page">
      <header className="vendor-page-topbar">
        <h1>{pageTitle}</h1>
        <p>{pageSubtitle}</p>
      </header>

      <div className="vendor-shell">
        <VendorSidebar
          activeView={activeView}
          onChangeView={setActiveView}
          onLogout={handleExit}
        />

        <main className="vendor-content">
          <VendorAppbar
            title={appbarTitle}
            vendor={vendor}
            onLogout={handleExit}
          />

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
