import { useEffect, useMemo, useRef, useState } from "react";
import { getMyTransactions } from "../api/auth";
import { Icon } from "./VendorIcon";

const transactionFilterOptions = [
  { label: "Last 3 Days", value: 3, unit: "days" },
  { label: "Last 7 Days", value: 7, unit: "days" },
  { label: "Last 15 Days", value: 15, unit: "days" },
  { label: "Last 1 Month", value: 1, unit: "months" },
];

const getTransactionDate = (transaction) => new Date(`${transaction.date} ${transaction.time}`);

const escapePdfText = (value) => String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const createPdfBlob = (title, rows) => {
  const pageHeight = 842;
  const lines = [
    title,
    `Generated: ${new Date().toLocaleString()}`,
    "",
    ...rows,
  ];

  const content = [
    "BT",
    "/F1 18 Tf",
    "50 792 Td",
    `(${escapePdfText(lines[0])}) Tj`,
    "/F1 11 Tf",
    ...lines.slice(1).flatMap((line) => ["0 -20 Td", `(${escapePdfText(line)}) Tj`]),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
};

const getTransactionPdfRows = (items) =>
  items.flatMap((transaction) => [
    `Transaction ID: ${transaction.id}`,
    `Customer: ${transaction.customer} (${transaction.customerId})`,
    `Amount: ${transaction.amount}`,
    `Date & Time: ${transaction.date} ${transaction.time}`,
    `Status: ${transaction.status}`,
    "",
  ]);

const getFilterCutoffDate = (selectedFilter, currentDate) => {
  const cutoffDate = new Date(currentDate);

  if (selectedFilter.unit === "months") {
    cutoffDate.setMonth(cutoffDate.getMonth() - selectedFilter.value);
  } else {
    cutoffDate.setDate(cutoffDate.getDate() - selectedFilter.value);
  }

  cutoffDate.setHours(0, 0, 0, 0);
  return cutoffDate;
};

const filterTransactionsByPeriod = (items, selectedFilter, currentDate = new Date()) => {
  if (!selectedFilter) {
    return items;
  }

  const cutoffDate = getFilterCutoffDate(selectedFilter, currentDate);

  return items.filter((transaction) => {
    const transactionDate = getTransactionDate(transaction);
    return !Number.isNaN(transactionDate.getTime()) && transactionDate >= cutoffDate;
  });
};

function VendorTransactionsPage({ vendor }) {
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [rawTransactions, setRawTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadTransactions = () => {
    const token = localStorage.getItem("cpacToken");
    if (!token) return;

    getMyTransactions(token)
      .then((data) => {
        if (data.success) {
          // Filter to only payments received by this vendor
          const vendorId = vendor?.id || vendor?._id;
          const filtered = (data.transactions || []).filter(
            (t) => t.vendor?._id === vendorId || t.vendor === vendorId
          );
          setRawTransactions(filtered);
        }
      })
      .catch((err) => console.error("Error loading vendor transactions:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTransactions();
  }, [vendor]);

  // Stats Card Calculations
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let todayRev = 0;
    let weekRev = 0;
    let monthRev = 0;
    let totalTxns = rawTransactions.length;

    rawTransactions.forEach((t) => {
      if (t.status !== "completed") return;

      const amt = Number(t.amount || 0);
      const isPayment = t.type === "payment";
      const isRefund = t.type === "refund";
      const factor = isPayment ? 1 : isRefund ? -1 : 0;
      const value = amt * factor;

      const d = new Date(t.createdAt);

      if (d >= today) {
        todayRev += value;
      }
      if (d >= oneWeekAgo) {
        weekRev += value;
      }
      if (d >= startOfMonth) {
        monthRev += value;
      }
    });

    return {
      todayRevenue: `₹${todayRev.toFixed(2)}`,
      weekRevenue: `₹${weekRev.toFixed(2)}`,
      monthRevenue: `₹${monthRev.toFixed(2)}`,
      totalTransactions: totalTxns,
    };
  }, [rawTransactions]);

  const formattedTransactions = useMemo(() => {
    return rawTransactions.map((t) => {
      const isRefund = t.type === "refund";
      const amountStr = `${isRefund ? "-" : ""}₹${Number(t.amount || 0).toFixed(2)}`;
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
        rawId: t._id,
        type: t.type,
        customer: customerName,
        customerId: customerIdVal,
        amount: amountStr,
        date: dateStr,
        time: timeStr,
        status: t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : "Completed",
      };
    });
  }, [rawTransactions]);

  const dateFilteredTransactions = useMemo(
    () => filterTransactionsByPeriod(formattedTransactions, selectedFilter),
    [formattedTransactions, selectedFilter]
  );

  const visibleTransactions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return dateFilteredTransactions;
    }

    return dateFilteredTransactions.filter((transaction) =>
      transaction.id.toLowerCase().includes(normalizedQuery)
    );
  }, [dateFilteredTransactions, searchQuery]);

  const handleFilterSelect = (option) => {
    setSelectedFilter(option);
    setIsFilterOpen(false);
  };

  const handleExport = () => {
    const rangeLabel = selectedFilter?.label || "All Transactions";
    const rows = dateFilteredTransactions.length
      ? getTransactionPdfRows(dateFilteredTransactions)
      : ["No transactions found for selected period."];
    const blob = createPdfBlob(`Vendor Transaction History - ${rangeLabel}`, rows);
    downloadBlob(blob, `vendor-transactions-${rangeLabel.toLowerCase().replaceAll(" ", "-")}.pdf`);
  };

  const emptyMessage = selectedFilter
    ? "No transactions found for selected period."
    : "No transactions found.";

  return (
    <>
      <section className="vendor-stats-grid vendor-transaction-stats" aria-label="Vendor transaction statistics">
        <article>
          <span>Today's Revenue</span>
          <strong>{stats.todayRevenue}</strong>
        </article>
        <article>
          <span>This Week</span>
          <strong>{stats.weekRevenue}</strong>
        </article>
        <article>
          <span>This Month</span>
          <strong>{stats.monthRevenue}</strong>
        </article>
        <article>
          <span>Total Transactions</span>
          <strong>{stats.totalTransactions}</strong>
        </article>
      </section>

      <section className="vendor-transaction-page" aria-label="Vendor transactions">
        <div className="vendor-transaction-tools">
          <form className="vendor-transaction-search" onSubmit={(e) => e.preventDefault()}>
            <Icon type="search" />
            <input
              type="search"
              placeholder="Search by transaction ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <div className="vendor-date-filter-menu" ref={dropdownRef}>
            <button
              className={`vendor-date-button${isFilterOpen ? " active" : ""}`}
              type="button"
              onClick={() => setIsFilterOpen((isOpen) => !isOpen)}
            >
              <Icon type="calendar" />
              {selectedFilter ? `Date Range: ${selectedFilter.label}` : "Date Range"}
            </button>
            {isFilterOpen && (
              <div className="vendor-date-dropdown" role="menu">
                {transactionFilterOptions.map((option) => (
                  <button
                    className={selectedFilter?.label === option.label ? "selected" : ""}
                    key={option.label}
                    type="button"
                    role="menuitem"
                    onClick={() => handleFilterSelect(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="vendor-export-button" type="button" onClick={handleExport}>
            <Icon type="download" />
            Export
          </button>
        </div>

        <div className="vendor-transactions-table vendor-full-transactions-table">
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
              {isLoading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", color: "#7c8497", padding: "24px 0" }}>
                    Loading transactions...
                  </td>
                </tr>
              ) : visibleTransactions.length ? (
                visibleTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.id}</td>
                    <td>
                      <strong>{transaction.customer}</strong>
                      <span>{transaction.customerId}</span>
                    </td>
                    <td>{transaction.amount}</td>
                    <td>
                      {transaction.date}
                      <span>{transaction.time}</span>
                    </td>
                    <td>
                      <span className="vendor-status-pill">{transaction.status}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", color: "#7c8497", padding: "24px 0" }}>
                    {emptyMessage}
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

export default VendorTransactionsPage;
