import { useEffect, useState, useMemo } from "react";
import { getMyTransactions } from "../api/auth";
import { Icon } from "./VendorIcon";

function VendorDashboardHomePage({ vendor, onShowTransactions }) {
  const [rawTransactions, setRawTransactions] = useState([]);

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
        <article>
          <div>
            <span>Today's Sales</span>
            <strong>{stats.todaySales}</strong>
            <em><Icon type="trend" />Dynamic</em>
          </div>
          <Icon type="dollar" />
        </article>
        <article>
          <div>
            <span>This Month</span>
            <strong>{stats.monthSales}</strong>
            <em><Icon type="trend" />Dynamic</em>
          </div>
          <Icon type="calendar" />
        </article>
        <article>
          <div>
            <span>Total Transactions</span>
            <strong>{stats.totalTransactions}</strong>
            <em><Icon type="trend" />Dynamic</em>
          </div>
          <Icon type="bag" />
        </article>
        <article>
          <div>
            <span>Avg. Order Value</span>
            <strong>{stats.avgOrderValue}</strong>
          </div>
          <em aria-label="Order value trending up"><Icon type="trend" /></em>
        </article>
      </section>

      <section className="vendor-qr-panel">
        <div className="vendor-qr-preview">
          <Icon type="qr" />
          <span>Your QR Code</span>
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
    </>
  );
}

export default VendorDashboardHomePage;

