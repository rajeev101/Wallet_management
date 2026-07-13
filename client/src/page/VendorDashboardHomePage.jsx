import { useEffect, useState, useMemo } from "react";
import { getMyTransactions } from "../api/auth";
import { Icon } from "./VendorIcon";

function VendorStatDetailModal({ type, vendor, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

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
          const vendorId = vendor?.id || vendor?._id;
          const filtered = (data.transactions || []).filter(
            (t) => t.vendor?._id === vendorId || t.vendor === vendorId
          );
          setTransactions(filtered);
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
  }, [vendor]);

  const isToday = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  };

  const isCurrentMonth = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth()
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", color: "#7c8497" }}>
          <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid rgba(99, 102, 241, 0.15)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "12px" }}></div>
          <span>Loading details...</span>
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

    if (type === "today") {
      const todaySales = transactions.filter((t) => t.type === "payment" && isToday(t.createdAt));
      const completedTodaySales = todaySales.filter((t) => t.status === "completed");

      const totalSalesToday = completedTodaySales.reduce((sum, t) => sum + t.amount, 0);
      const totalOrdersToday = completedTodaySales.length;
      const highestSale = totalOrdersToday > 0 ? Math.max(...completedTodaySales.map((t) => t.amount)) : 0;
      const lowestSale = totalOrdersToday > 0 ? Math.min(...completedTodaySales.map((t) => t.amount)) : 0;

      return (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", background: "#f8f9fb", padding: "16px", borderRadius: "10px", marginBottom: "20px" }}>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Total Sales Today</span>
              <strong style={{ fontSize: "1.4rem", color: "#10b981", fontWeight: "600" }}>₹{totalSalesToday.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Orders Today</span>
              <strong style={{ fontSize: "1.4rem", color: "#1a1d2e", fontWeight: "600" }}>{totalOrdersToday}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Highest Sale</span>
              <strong style={{ fontSize: "1.2rem", color: "#1a1d2e", fontWeight: "600" }}>₹{highestSale.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Lowest Sale</span>
              <strong style={{ fontSize: "1.2rem", color: "#1a1d2e", fontWeight: "600" }}>₹{lowestSale.toFixed(2)}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1d2e", marginBottom: "12px" }}>Today's Sales List</h3>

          {todaySales.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#7c8497" }}>
              No sales found for today.
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "8px", background: "#ffffff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8f9fb" }}>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Date & Time</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Student</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Amount</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Transaction ID</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Method</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todaySales.map((t) => {
                    const d = new Date(t.createdAt);
                    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    return (
                      <tr key={t._id} style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                        <td style={{ padding: "12px 14px", color: "#374151" }}>
                          {dateStr}
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#9ca3b4", marginTop: "2px" }}>{timeStr}</span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#1a1d2e", fontWeight: "500" }}>{t.student?.name || t.student?._id || "Student"}</td>
                        <td style={{ padding: "12px 14px", color: "#10b981", fontWeight: "600" }}>₹{Number(t.amount || 0).toFixed(2)}</td>
                        <td style={{ padding: "12px 14px", color: "#7c8497", fontSize: "0.75rem" }}>{t._id}</td>
                        <td style={{ padding: "12px 14px", color: "#374151" }}>Wallet</td>
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

    if (type === "month") {
      const monthlySales = transactions.filter((t) => t.type === "payment" && isCurrentMonth(t.createdAt));
      const completedMonthlySales = monthlySales.filter((t) => t.status === "completed");

      const totalMonthlySales = completedMonthlySales.reduce((sum, t) => sum + t.amount, 0);
      const totalOrdersMonth = completedMonthlySales.length;
      const highestOrder = totalOrdersMonth > 0 ? Math.max(...completedMonthlySales.map((t) => t.amount)) : 0;
      const lowestOrder = totalOrdersMonth > 0 ? Math.min(...completedMonthlySales.map((t) => t.amount)) : 0;
      const avgOrderValue = totalOrdersMonth > 0 ? totalMonthlySales / totalOrdersMonth : 0;

      return (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", background: "#f8f9fb", padding: "16px", borderRadius: "10px", marginBottom: "20px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Total Monthly Sales</span>
              <strong style={{ fontSize: "1.6rem", color: "#10b981", fontWeight: "600" }}>₹{totalMonthlySales.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Orders This Month</span>
              <strong style={{ fontSize: "1.2rem", color: "#1a1d2e", fontWeight: "600" }}>{totalOrdersMonth}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Average Order Value</span>
              <strong style={{ fontSize: "1.2rem", color: "#6366f1", fontWeight: "600" }}>₹{avgOrderValue.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Highest Order</span>
              <strong style={{ fontSize: "1.2rem", color: "#1a1d2e", fontWeight: "600" }}>₹{highestOrder.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Lowest Order</span>
              <strong style={{ fontSize: "1.2rem", color: "#1a1d2e", fontWeight: "600" }}>₹{lowestOrder.toFixed(2)}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1d2e", marginBottom: "12px" }}>Monthly Sales List</h3>

          {monthlySales.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#7c8497" }}>
              No sales found for this month.
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "8px", background: "#ffffff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8f9fb" }}>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Date & Time</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Student</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Amount</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Transaction ID</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySales.map((t) => {
                    const d = new Date(t.createdAt);
                    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    return (
                      <tr key={t._id} style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                        <td style={{ padding: "12px 14px", color: "#374151" }}>
                          {dateStr}
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#9ca3b4", marginTop: "2px" }}>{timeStr}</span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#1a1d2e", fontWeight: "500" }}>{t.student?.name || t.student?._id || "Student"}</td>
                        <td style={{ padding: "12px 14px", color: "#10b981", fontWeight: "600" }}>₹{Number(t.amount || 0).toFixed(2)}</td>
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

    if (type === "total") {
      const totalTxns = transactions.length;
      const completedTxns = transactions.filter((t) => t.status === "completed");
      const failedTxns = transactions.filter((t) => t.status === "failed");
      const pendingTxns = transactions.filter((t) => t.status === "pending");
      const totalRevenue = completedTxns.reduce((sum, t) => sum + t.amount, 0);

      // Paginated list
      const totalPages = Math.ceil(totalTxns / recordsPerPage);
      const paginatedTxns = transactions.slice(
        (currentPage - 1) * recordsPerPage,
        currentPage * recordsPerPage
      );

      return (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", background: "#f8f9fb", padding: "14px", borderRadius: "10px", marginBottom: "20px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Total Revenue</span>
              <strong style={{ fontSize: "1.4rem", color: "#10b981", fontWeight: "600" }}>₹{totalRevenue.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Total Txns</span>
              <strong style={{ fontSize: "1.1rem", color: "#1a1d2e", fontWeight: "600" }}>{totalTxns}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Completed</span>
              <strong style={{ fontSize: "1.1rem", color: "#10b981", fontWeight: "600" }}>{completedTxns.length}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Pending</span>
              <strong style={{ fontSize: "1.1rem", color: "#d97706", fontWeight: "600" }}>{pendingTxns.length}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1d2e", marginBottom: "12px" }}>Transaction History</h3>

          {transactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#7c8497" }}>
              No transactions found.
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "8px", background: "#ffffff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fb" }}>
                      <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Date & Time</th>
                      <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Student</th>
                      <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Amount</th>
                      <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Transaction ID</th>
                      <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTxns.map((t) => {
                      const d = new Date(t.createdAt);
                      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                      const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                      return (
                        <tr key={t._id} style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                          <td style={{ padding: "12px 14px", color: "#374151" }}>
                            {dateStr}
                            <span style={{ display: "block", fontSize: "0.75rem", color: "#9ca3b4", marginTop: "2px" }}>{timeStr}</span>
                          </td>
                          <td style={{ padding: "12px 14px", color: "#1a1d2e", fontWeight: "500" }}>{t.student?.name || t.student?._id || "Student"}</td>
                          <td style={{ padding: "12px 14px", color: "#1a1d2e", fontWeight: "600" }}>₹{Number(t.amount || 0).toFixed(2)}</td>
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

              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: "6px",
                      background: "#ffffff",
                      padding: "6px 12px",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      opacity: currentPage === 1 ? 0.6 : 1,
                      fontSize: "0.8rem",
                      fontWeight: "500"
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: "0.8rem", color: "#7c8497" }}>Page {currentPage} of {totalPages}</span>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: "6px",
                      background: "#ffffff",
                      padding: "6px 12px",
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                      opacity: currentPage === totalPages ? 0.6 : 1,
                      fontSize: "0.8rem",
                      fontWeight: "500"
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    if (type === "avg") {
      const orderTxns = transactions.filter((t) => t.type === "payment" && t.status === "completed");
      const totalRevenue = orderTxns.reduce((sum, t) => sum + t.amount, 0);
      const totalCount = orderTxns.length;
      const avgOrderValue = totalCount > 0 ? totalRevenue / totalCount : 0;
      const highest = totalCount > 0 ? Math.max(...orderTxns.map((t) => t.amount)) : 0;
      const lowest = totalCount > 0 ? Math.min(...orderTxns.map((t) => t.amount)) : 0;

      return (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", background: "#f8f9fb", padding: "16px", borderRadius: "10px", marginBottom: "20px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Average Order Value</span>
              <strong style={{ fontSize: "1.6rem", color: "#6366f1", fontWeight: "600" }}>₹{avgOrderValue.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Total Revenue</span>
              <strong style={{ fontSize: "1.2rem", color: "#10b981", fontWeight: "600" }}>₹{totalRevenue.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Total Orders Used</span>
              <strong style={{ fontSize: "1.2rem", color: "#1a1d2e", fontWeight: "600" }}>{totalCount}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Highest Order</span>
              <strong style={{ fontSize: "1.2rem", color: "#1a1d2e", fontWeight: "600" }}>₹{highest.toFixed(2)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#7c8497", textTransform: "uppercase", fontWeight: "500", display: "block" }}>Lowest Order</span>
              <strong style={{ fontSize: "1.2rem", color: "#1a1d2e", fontWeight: "600" }}>₹{lowest.toFixed(2)}</strong>
            </div>
          </div>

          <h3 style={{ fontSize: "0.95rem", fontWeight: "600", color: "#1a1d2e", marginBottom: "12px" }}>Completed Orders List</h3>

          {orderTxns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#7c8497" }}>
              No completed orders found.
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "8px", background: "#ffffff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8f9fb" }}>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Date & Time</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Student</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Amount</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Transaction ID</th>
                    <th style={{ padding: "10px 14px", fontWeight: "500", color: "#7c8497", textTransform: "uppercase", fontSize: "0.7rem" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orderTxns.map((t) => {
                    const d = new Date(t.createdAt);
                    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                    return (
                      <tr key={t._id} style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                        <td style={{ padding: "12px 14px", color: "#374151" }}>
                          {dateStr}
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#9ca3b4", marginTop: "2px" }}>{timeStr}</span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#1a1d2e", fontWeight: "500" }}>{t.student?.name || t.student?._id || "Student"}</td>
                        <td style={{ padding: "12px 14px", color: "#10b981", fontWeight: "600" }}>₹{Number(t.amount || 0).toFixed(2)}</td>
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
  };

  const getTitle = () => {
    if (type === "today") return "Today's Completed Sales";
    if (type === "month") return "Monthly Sales Analytics";
    if (type === "total") return "Total Transactions History";
    if (type === "avg") return "Average Order Value Analytics";
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

function VendorDashboardHomePage({ vendor, onShowTransactions }) {
  const [rawTransactions, setRawTransactions] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const [qrError, setQrError] = useState(false);

  const vendorId = vendor?.id || vendor?._id || "";
  const qrUrl = useMemo(() => {
    return vendorId
      ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${vendorId}`
      : "";
  }, [vendorId]);

  useEffect(() => {
    setQrError(false);
  }, [vendorId]);

  useEffect(() => {
    const token = localStorage.getItem("cpacToken");
    if (!token) return;

    getMyTransactions(token)
      .then((data) => {
        if (data.success) {
          const vendorId = vendor?.id || vendor?._id;
          const filtered = (data.transactions || []).filter(
            (t) => t.vendor?._id === vendorId || t.vendor === vendorId
          );
          setRawTransactions(filtered);
        }
      })
      .catch((err) => console.error("Error loading vendor transactions:", err));
  }, [vendor]);

  // Calculations for stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let todaySales = 0;
    let monthSales = 0;
    let totalTxns = rawTransactions.length;
    let totalAmt = 0;

    rawTransactions.forEach((t) => {
      const amt = Number(t.amount || 0);
      const d = new Date(t.createdAt);

      totalAmt += amt;
      if (d >= today) {
        todaySales += amt;
      }
      if (d >= startOfMonth) {
        monthSales += amt;
      }
    });

    const avgOrderValue = totalTxns > 0 ? totalAmt / totalTxns : 0;

    return {
      todaySales: `₹${todaySales.toFixed(2)}`,
      monthSales: `₹${monthSales.toFixed(2)}`,
      totalTransactions: totalTxns,
      avgOrderValue: `₹${avgOrderValue.toFixed(2)}`,
    };
  }, [rawTransactions]);

  const formattedTransactions = useMemo(() => {
    return rawTransactions.slice(0, 5).map((t) => {
      const amountStr = `₹${Number(t.amount || 0).toFixed(2)}`;
      const customerName = t.student?.name || "Campus Student";
      const customerIdVal = t.student?.email || "student@campus.edu";

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
        customer: customerName,
        customerId: customerIdVal,
        amount: amountStr,
        date: dateStr,
        time: timeStr,
        status: t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : "Completed",
      };
    });
  }, [rawTransactions]);

  return (
    <>
      <section className="vendor-stats-grid" aria-label="Vendor sales statistics">
        <article style={{ cursor: "pointer" }} onClick={() => setActiveModal("today")}>
          <div>
            <span>Today's Sales</span>
            <strong>{stats.todaySales}</strong>
            <em><Icon type="trend" />Dynamic</em>
          </div>
          <Icon type="dollar" />
        </article>
        <article style={{ cursor: "pointer" }} onClick={() => setActiveModal("month")}>
          <div>
            <span>This Month</span>
            <strong>{stats.monthSales}</strong>
            <em><Icon type="trend" />Dynamic</em>
          </div>
          <Icon type="calendar" />
        </article>
        <article style={{ cursor: "pointer" }} onClick={() => setActiveModal("total")}>
          <div>
            <span>Total Transactions</span>
            <strong>{stats.totalTransactions}</strong>
            <em><Icon type="trend" />Dynamic</em>
          </div>
          <Icon type="bag" />
        </article>
        <article style={{ cursor: "pointer" }} onClick={() => setActiveModal("avg")}>
          <div>
            <span>Avg. Order Value</span>
            <strong>{stats.avgOrderValue}</strong>
          </div>
          <em aria-label="Order value trending up"><Icon type="trend" /></em>
        </article>
      </section>

      <section className="vendor-qr-panel">
        <div className="vendor-qr-preview dev-vendor-QR-preview">
          {!vendorId ? (
            <div style={{ color: "#64748b" }}>Loading QR Code...</div>
          ) : qrError || !qrUrl ? (
            <>
              <Icon type="qr" />
              <span>Your QR Code</span>
            </>
          ) : (
            <img 
              src={qrUrl} 
              alt="Vendor Payment QR Code" 
              style={{ width: "150px", height: "150px", objectFit: "contain" }} 
              onError={() => setQrError(true)}
            />
          )}
        </div>
        <div>
          <h2>Payment QR Code</h2>
          <p>Students can scan this QR code or use your vendor ID to make payments to your store.</p>
          <div style={{ margin: "10px 0 20px 0", fontSize: "14px", color: "#4a5568" }}>
            <strong>Your Vendor ID:</strong> <code style={{ background: "#edf2f7", padding: "4px 8px", borderRadius: "4px" }}>{vendor?.id || vendor?._id || "Loading..."}</code>
          </div>
        </div>
      </section>

      <section className="vendor-transactions-section">
        <div className="vendor-section-heading">
          <h2>Recent Transactions</h2>
          <button type="button" onClick={onShowTransactions}>View All</button>
        </div>

        <div className="vendor-transactions-table">
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Date &amp; Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {formattedTransactions.length ? (
                formattedTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.id}</td>
                    <td>{transaction.customer}</td>
                    <td>{transaction.amount}</td>
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

      {activeModal && (
        <VendorStatDetailModal
          type={activeModal}
          vendor={vendor}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
}

export default VendorDashboardHomePage;

