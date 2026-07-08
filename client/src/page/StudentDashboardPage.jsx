import { useState, useEffect } from "react";
import StudentAddMoneyPage from "./StudentAddMoneyPage";
import StudentProfilePage from "./StudentProfilePage";
import StudentScanPayPage from "./StudentScanPayPage";
import StudentTransactionsPage from "./StudentTransactionsPage";
import { transactions } from "./StudentDashboardData";
import { Icon } from "./StudentIcon";
import { getProfile } from "../api/auth";

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

function StudentDashboardPage({ setPage }) {
  const [activeView, setActiveView] = useState("dashboard");
  const [student, setStudent] = useState(getStoredStudent);

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

  useEffect(() => {
    fetchLatestProfile();
  }, [activeView]);

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
                  <strong>${Number(student.walletBalance || 0).toFixed(2)}</strong>
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
                    <strong>$154.20</strong>
                    <span>24 transactions</span>
                  </div>
                  <span className="stat-icon spent"><Icon type="up" /></span>
                </article>
                <article className="stat-card">
                  <div>
                    <p>Added This Month</p>
                    <strong>$200.00</strong>
                    <span>2 recharges</span>
                  </div>
                  <span className="stat-icon added"><Icon type="down" /></span>
                </article>
                <article className="stat-card">
                  <div>
                    <p>Avg. Transaction</p>
                    <strong>$6.42</strong>
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
                      {transactions.map((transaction) => (
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeView === "scan" && (
            <StudentScanPayPage student={student} refreshProfile={fetchLatestProfile} />
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
