import { useState, useEffect } from "react";
import StudentAddMoneyPage from "./StudentAddMoneyPage";
import StudentHeader from "./StudentHeader";
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
      profilePicture: storedUser.profilePicture || "",
      accountType: storedUser.accountType || "student",
      walletBalance: storedUser.walletBalance || 0,
    };
  } catch {
    return {
      id: "",
      name: "",
      email: "",
      phone: "",
      profilePicture: "",
      accountType: "student",
    };
  }
};

const studentPageCopy = {
  dashboard: {
    title: "Student Dashboard",
    subtitle: "Overview of your wallet and recent activity.",
  },
  scan: {
    title: "Scan to Pay",
    subtitle: "Scan a QR code to make a secure payment.",
  },
  transactions: {
    title: "Transactions",
    subtitle: "View your complete transaction history.",
  },
  addMoney: {
    title: "Add Money",
    subtitle: "Recharge your wallet securely.",
  },
  profile: {
    title: "Profile",
    subtitle: "Manage your personal information.",
  },
};

function StudentDashboardPage({ setPage }) {
  const [activeView, setActiveView] = useState("dashboard");
  const [student, setStudent] = useState(getStoredStudent);
  const { title, subtitle } = studentPageCopy[activeView] || studentPageCopy.dashboard;

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
            profilePicture: safeUser.profilePicture || "",
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

  return (
    <div className="student-dashboard-page">
      <header className="student-topbar">
        <h1>{title}</h1>
        <p>{subtitle}</p>
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
                <article className="stat-card">
                  <div>
                    <p>This Month Spent</p>
                    <strong>₹154.20</strong>
                    <span>24 transactions</span>
                  </div>
                  <span className="stat-icon spent"><Icon type="up" /></span>
                </article>
                <article className="stat-card">
                  <div>
                    <p>Added This Month</p>
                    <strong>₹200.00</strong>
                    <span>2 recharges</span>
                  </div>
                  <span className="stat-icon added"><Icon type="down" /></span>
                </article>
                <article className="stat-card">
                  <div>
                    <p>Avg. Transaction</p>
                    <strong>₹6.42</strong>
                    <span>Last 30 days</span>
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

          {activeView === "scan" && (
            <StudentScanPayPage
              student={student}
              refreshProfile={fetchLatestProfile}
            />
          )}
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
    </div>
  );
}

export default StudentDashboardPage;
