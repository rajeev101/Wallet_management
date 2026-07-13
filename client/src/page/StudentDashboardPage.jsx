import { useState, useEffect } from "react";
import StudentAddMoneyPage from "./StudentAddMoneyPage";
import StudentProfilePage from "./StudentProfilePage";
import StudentScanPayPage from "./StudentScanPayPage";
import StudentTransactionsPage from "./StudentTransactionsPage";
import { Icon } from "./StudentIcon";
import { getProfile, getMyTransactions } from "../api/auth";

const getStoredStudent = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("cpacUser") || "{}");

    return {
      id: storedUser._id || storedUser.id || "",
      name: storedUser.name || "",
      email: storedUser.email || "",
      phone: storedUser.phone || "",
      accountType: storedUser.accountType || "student",
      walletBalance: storedUser.walletBalance || 0,
    };
  } catch {
    return {
      id: "",
      name: "",
      email: "",
      phone: "",
      accountType: "student",
    };
  }
};

function StatDetailModal({ type, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("cpacToken");
    if (!token) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getMyTransactions(token)
      .then((data) => {
        if (data.success) {
          setTransactions(data.transactions || []);
        } else {
          setError(data.message || "Failed to fetch transactions");
        }
      })
      .catch((err) => {
        setError(err.message || "An error occurred while fetching transactions");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const currentMonthTxns = transactions.filter((t) => {
    const d = new Date(t.createdAt);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  const getAddedBy = (t) => {
    if (t.createdBy) {
      return t.createdBy.name || (t.createdBy.accountType === "admin" ? "Admin" : "System");
    }
    return t.status === "completed" ? "Admin" : "System";
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", color: "#7c8497" }}>
          <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid rgba(99, 102, 241, 0.15)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "12px" }}></div>
          <span>Loading transactions...</span>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ color: "#ef4444", padding: "20px", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fee2e2", margin: "10px 0", textAlign: "center" }}>
          <strong>Error:</strong> {error}
        </div>
      );
    }

    if (type === "spend") {
      const spendTxns = currentMonthTxns.filter((t) => t.type === "payment");
      const totalSpend = spendTxns.reduce((sum, t) => sum + (t.status !== "failed" ? t.amount : 0), 0);

      return (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", background: "#f8f9fb", padding: "16px", borderRadius: "10px", marginBottom: "20px" }}>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Total Monthly Spend</span>
              <strong style={{ fontSize: "1.5rem", color: "#1a1d2e", fontWeight: "600" }}>₹{totalSpend.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Transactions</span>
              <strong style={{ fontSize: "1.5rem", color: "#1a1d2e", fontWeight: "600" }}>{spendTxns.length}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1d2e", marginBottom: "12px" }}>Transactions List</h3>
          
          {spendTxns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#7c8497" }}>
              No spend transactions found for the current month.
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "8px", background: "#ffffff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8f9fb" }}>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Date & Time</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Vendor</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Amount</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>ID</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {spendTxns.map((t) => {
                    const d = new Date(t.createdAt);
                    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    return (
                      <tr key={t._id} style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                        <td style={{ padding: "12px 14px", color: "#374151" }}>
                          {dateStr}
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#9ca3b4", marginTop: "2px" }}>{timeStr}</span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#1a1d2e", fontWeight: "500" }}>{t.vendor?.name || "Campus Vendor"}</td>
                        <td style={{ padding: "12px 14px", color: "#ef4444", fontWeight: "600" }}>-₹{Number(t.amount || 0).toFixed(2)}</td>
                        <td style={{ padding: "12px 14px", color: "#7c8497", fontSize: "0.75rem" }}>{t._id}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ 
                            padding: "4px 8px", 
                            borderRadius: "12px", 
                            fontSize: "0.75rem", 
                            fontWeight: "500",
                            background: t.status === "completed" ? "#ecfdf5" : t.status === "pending" ? "#fffbeb" : "#fef2f2",
                            color: t.status === "completed" ? "#10b981" : t.status === "pending" ? "#d97706" : "#ef4444"
                          }}>
                            {t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : "Completed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    if (type === "add") {
      const addTxns = currentMonthTxns.filter((t) => t.type === "wallet_topup");
      const totalAdded = addTxns.reduce((sum, t) => sum + (t.status === "completed" ? t.amount : 0), 0);

      return (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", background: "#f8f9fb", padding: "16px", borderRadius: "10px", marginBottom: "20px" }}>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Total Added This Month</span>
              <strong style={{ fontSize: "1.5rem", color: "#1a1d2e", fontWeight: "600" }}>₹{totalAdded.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Top-ups</span>
              <strong style={{ fontSize: "1.5rem", color: "#1a1d2e", fontWeight: "600" }}>{addTxns.length}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1d2e", marginBottom: "12px" }}>Top-up Request History</h3>

          {addTxns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#7c8497" }}>
              No wallet top-up transactions found for the current month.
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "8px", background: "#ffffff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8f9fb" }}>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Date & Time</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Amount</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Added By</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>ID</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {addTxns.map((t) => {
                    const d = new Date(t.createdAt);
                    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    return (
                      <tr key={t._id} style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                        <td style={{ padding: "12px 14px", color: "#374151" }}>
                          {dateStr}
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#9ca3b4", marginTop: "2px" }}>{timeStr}</span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#10b981", fontWeight: "600" }}>+₹{Number(t.amount || 0).toFixed(2)}</td>
                        <td style={{ padding: "12px 14px", color: "#374151" }}>{getAddedBy(t)}</td>
                        <td style={{ padding: "12px 14px", color: "#7c8497", fontSize: "0.75rem" }}>{t._id}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ 
                            padding: "4px 8px", 
                            borderRadius: "12px", 
                            fontSize: "0.75rem", 
                            fontWeight: "500",
                            background: t.status === "completed" ? "#ecfdf5" : t.status === "pending" ? "#fffbeb" : "#fef2f2",
                            color: t.status === "completed" ? "#10b981" : t.status === "pending" ? "#d97706" : "#ef4444"
                          }}>
                            {t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : "Completed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    if (type === "avg") {
      const spendTxns = currentMonthTxns.filter((t) => t.type === "payment" && t.status === "completed");
      const totalSpend = spendTxns.reduce((sum, t) => sum + t.amount, 0);
      const totalCount = spendTxns.length;
      const avgSpend = totalCount > 0 ? totalSpend / totalCount : 0;
      const highest = totalCount > 0 ? Math.max(...spendTxns.map((t) => t.amount)) : 0;
      const lowest = totalCount > 0 ? Math.min(...spendTxns.map((t) => t.amount)) : 0;

      return (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", background: "#f8f9fb", padding: "16px", borderRadius: "10px", marginBottom: "20px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Average Transaction Amount</span>
              <strong style={{ fontSize: "1.75rem", color: "#6366f1", fontWeight: "600" }}>₹{avgSpend.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Total Spend</span>
              <strong style={{ fontSize: "1.2rem", color: "#1a1d2e", fontWeight: "600" }}>₹{totalSpend.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Total Transactions</span>
              <strong style={{ fontSize: "1.2rem", color: "#1a1d2e", fontWeight: "600" }}>{totalCount}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Highest Transaction</span>
              <strong style={{ fontSize: "1.2rem", color: "#10b981", fontWeight: "600" }}>₹{highest.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Lowest Transaction</span>
              <strong style={{ fontSize: "1.2rem", color: "#ef4444", fontWeight: "600" }}>₹{lowest.toFixed(2)}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1d2e", marginBottom: "12px" }}>Transactions Used in Calculation</h3>

          {spendTxns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#7c8497" }}>
              No completed payments found for the current month.
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "8px", background: "#ffffff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8f9fb" }}>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Date & Time</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Vendor</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Amount</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {spendTxns.map((t) => {
                    const d = new Date(t.createdAt);
                    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    return (
                      <tr key={t._id} style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                        <td style={{ padding: "12px 14px", color: "#374151" }}>
                          {dateStr}
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#9ca3b4", marginTop: "2px" }}>{timeStr}</span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#1a1d2e", fontWeight: "500" }}>{t.vendor?.name || "Campus Vendor"}</td>
                        <td style={{ padding: "12px 14px", color: "#ef4444", fontWeight: "600" }}>-₹{Number(t.amount || 0).toFixed(2)}</td>
                        <td style={{ padding: "12px 14px", color: "#7c8497", fontSize: "0.75rem" }}>{t._id}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }
  };

  const getTitle = () => {
    if (type === "spend") return "This Month Spend Details";
    if (type === "add") return "Add This Month Details";
    if (type === "avg") return "Average Transaction Analytics";
    return "Details";
  };

  return (
    <div 
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 22, 41, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px"
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: "#ffffff",
          width: "min(680px, 100%)",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
          border: "1px solid rgba(0, 0, 0, 0.08)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: "16px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: "600", color: "#1a1d2e", margin: 0 }}>{getTitle()}</h2>
          <button 
            onClick={onClose} 
            style={{ border: 0, background: "transparent", fontSize: "1.5rem", cursor: "pointer", color: "#7c8497", padding: "0 4px", display: "flex", alignItems: "center" }}
            type="button"
          >
            &times;
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

function StudentDashboardPage({ setPage }) {
  const [activeView, setActiveView] = useState("dashboard");
  const [student, setStudent] = useState(getStoredStudent);
  const [activeModal, setActiveModal] = useState(null);

  const fetchLatestProfile = () => {
    const token = localStorage.getItem("cpacToken");
    if (!token) return;
    getProfile(token)
      .then((data) => {
        if (data.success && data.user) {
          const safeUser = { ...data.user };
          delete safeUser.password;
          localStorage.setItem("cpacUser", JSON.stringify(safeUser));
          setStudent({
            id: safeUser._id || safeUser.id || "",
            name: safeUser.name || "",
            email: safeUser.email || "",
            phone: safeUser.phone || "",
            accountType: safeUser.accountType || "student",
            walletBalance: safeUser.walletBalance || 0,
          });
        }
      })
      .catch((err) => console.error("Failed to fetch profile in dashboard:", err));
  };

  const [rawTransactions, setRawTransactions] = useState([]);

  const fetchRecentTransactions = () => {
    const token = localStorage.getItem("cpacToken");
    if (!token) return;
    getMyTransactions(token)
      .then((data) => {
        if (data.success) {
          setRawTransactions(data.transactions || []);
        }
      })
      .catch((err) => console.error("Failed to fetch transactions in dashboard:", err));
  };

  useEffect(() => {
    fetchLatestProfile();
    fetchRecentTransactions();
  }, [activeView]);

  const formattedTransactions = rawTransactions.slice(0, 5).map((t) => {
    const isTopup = t.type === "wallet_topup";

    const isRefund = t.type === "refund";

    const isPayment = t.type === "payment";
    
    const currentUserId = student.id || student._id;

    let amountStr = "";
    if (isTopup) {
      amountStr = `+₹${Number(t.amount || 0).toFixed(2)}`;
    } else if (isPayment) {
      if (t.student?._id === currentUserId || t.student === currentUserId) {
        amountStr = `-₹${Number(t.amount || 0).toFixed(2)}`;
      } else {
        amountStr = `+₹${Number(t.amount || 0).toFixed(2)}`;
      }
    } else if (isRefund) {
      amountStr = `+₹${Number(t.amount || 0).toFixed(2)}`;
    }

    let displayDesc = "";
    if (isTopup) {
      displayDesc = t.description || "Wallet Recharge";
    } else if (isPayment) {
      displayDesc = t.vendor?.name || "Campus Vendor";
    } else if (isRefund) {
      displayDesc = t.description || "Refund";
    }

    const d = new Date(t.createdAt);
    const dateStr = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    return {
      id: t._id,
      vendor: displayDesc,
      amount: amountStr,
      date: dateStr,
      time: timeStr,
      status: t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : "Completed",
    };
  });

  // Calculate statistics for the dashboard cards dynamically
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const currentMonthTxns = rawTransactions.filter((t) => {
    const d = new Date(t.createdAt);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  const currentMonthPayments = currentMonthTxns.filter((t) => t.type === "payment" && t.status === "completed");
  const currentMonthTopups = currentMonthTxns.filter((t) => t.type === "wallet_topup" && t.status === "completed");

  const totalSpent = currentMonthPayments.reduce((sum, t) => sum + t.amount, 0);
  const spentCount = currentMonthPayments.length;

  const totalAdded = currentMonthTopups.reduce((sum, t) => sum + t.amount, 0);
  const addedCount = currentMonthTopups.length;

  const avgTransaction = spentCount > 0 ? totalSpent / spentCount : 0;

  const handleExit = () => {
    localStorage.removeItem("cpacToken");
    localStorage.removeItem("cpacUserType");
    localStorage.removeItem("cpacUser");
    setPage("login");
  };

  const showDashboard = () => setActiveView("dashboard");
  const showScanner = () => setActiveView("scan");
  const showTransactions = () => setActiveView("transactions");
  const showAddMoney = () => setActiveView("addMoney");
  const showProfile = () => setActiveView("profile");

  const pageCopy = {
    dashboard: ["Student Dashboard", "Student wallet and payment interface"],
    scan: ["Scan to Pay", "QR code scanner for quick payments"],
    transactions: ["Transaction History", "View all past transactions"],
    addMoney: ["Add Money Request", "Request wallet balance top-up"],
    profile: ["Student Profile", "Manage your personal information"],
  };

  const [pageTitle, pageSubtitle] = pageCopy[activeView] || pageCopy.dashboard;

  return (
    <div className="student-dashboard-page">
      <header className="student-topbar">
        <h1>{pageTitle}</h1>
        <p>{pageSubtitle}</p>
      </header>

      <div className="student-shell">
        <aside className="student-sidebar">
          <nav className="student-nav" aria-label="Student dashboard navigation">
            <button
              className={activeView === "dashboard" ? "active" : ""}
              type="button"
              onClick={showDashboard}
            >
              <Icon type="dashboard" />
              Dashboard
            </button>
            <button
              className={activeView === "scan" ? "active" : ""}
              type="button"
              onClick={showScanner}
            >
              <Icon type="wallet" />
              Scan to Pay
            </button>
            <button
              className={activeView === "transactions" ? "active" : ""}
              type="button"
              onClick={showTransactions}
            >
              <Icon type="swap" />
              Transactions
            </button>
            <button
              className={activeView === "addMoney" ? "active" : ""}
              type="button"
              onClick={showAddMoney}
            >
              <Icon type="wallet" />
              Add Money
            </button>
            <button
              className={activeView === "profile" ? "active" : ""}
              type="button"
              onClick={showProfile}
            >
              <Icon type="settings" />
              Profile
            </button>
          </nav>

          <button className="student-logout" type="button" onClick={handleExit}>
            <Icon type="logout" />
            Logout
          </button>
        </aside>

        <main className={activeView === "profile" ? "student-content student-profile-content" : "student-content"}>
          {activeView === "dashboard" && (
            <>
              <section className="balance-panel" aria-label="Wallet balance">
                <div>
                  <p>Available Balance</p>
                  <strong>₹{Number(student.walletBalance || 0).toFixed(2)}</strong>
                </div>
                <Icon type="wallet" />
                <div className="balance-actions">
                  <button className="scan-button" type="button" onClick={showScanner}>
                    <Icon type="qr" />
                    Scan to Pay
                  </button>
                  <button className="add-button" type="button" onClick={showAddMoney}>
                    <Icon type="plus" />
                    Add Money
                  </button>
                </div>
              </section>

              <section className="stats-grid" aria-label="Wallet statistics">
                <article 
                  className="stat-card" 
                  style={{ cursor: "pointer" }} 
                  onClick={() => setActiveModal("spend")}
                >
                  <div>
                    <p>This Month Spent</p>
                    <strong>₹{totalSpent.toFixed(2)}</strong>
                    <span>{spentCount} transactions</span>
                  </div>
                  <span className="stat-icon spent"><Icon type="up" /></span>
                </article>
                <article 
                  className="stat-card" 
                  style={{ cursor: "pointer" }} 
                  onClick={() => setActiveModal("add")}
                >
                  <div>
                    <p>Added This Month</p>
                    <strong>₹{totalAdded.toFixed(2)}</strong>
                    <span>{addedCount} recharges</span>
                  </div>
                  <span className="stat-icon added"><Icon type="down" /></span>
                </article>
                <article 
                  className="stat-card" 
                  style={{ cursor: "pointer" }} 
                  onClick={() => setActiveModal("avg")}
                >
                  <div>
                    <p>Avg. Transaction</p>
                    <strong>₹{avgTransaction.toFixed(2)}</strong>
                    <span>This month</span>
                  </div>
                  <span className="stat-icon average"><Icon type="clock" /></span>
                </article>
              </section>

              <section className="transactions-section">
                <div className="section-heading">
                  <h2>Recent Transactions</h2>
                  <button type="button" onClick={showTransactions}>View All</button>
                </div>

                <div className="transactions-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Transaction ID</th>
                        <th>Vendor/Description</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formattedTransactions.length ? (
                        formattedTransactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td>{transaction.id}</td>
                            <td>{transaction.vendor}</td>
                            <td className={transaction.amount.startsWith("+") ? "positive" : ""}>
                              {transaction.amount}
                            </td>
                            <td>
                              {transaction.date}
                              <span>{transaction.time}</span>
                            </td>
                            <td>{transaction.status}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ textAlign: "center", color: "#7c8497", padding: "16px 0" }}>
                            No recent transactions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeView === "scan" && <StudentScanPayPage student={student} refreshProfile={fetchLatestProfile} />}
          {activeView === "transactions" && (
            <StudentTransactionsPage
              student={student}
              onLogout={handleExit}
            />
          )}
          {activeView === "addMoney" && (
            <StudentAddMoneyPage
              student={student}
              onLogout={handleExit}
              refreshProfile={fetchLatestProfile}
            />
          )}
          {activeView === "profile" && (
            <StudentProfilePage
              initialStudent={student}
              onProfileChange={setStudent}
            />
          )}
        </main>
      </div>

      {activeModal && (
        <StatDetailModal 
          type={activeModal} 
          onClose={() => setActiveModal(null)} 
        />
      )}
    </div>
  );
}

 
export default StudentDashboardPage;
