import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { getMyTransactions } from "../api/auth";

import { Icon } from "./StudentIcon";
import StudentHeader from "./StudentHeader";
import formatStudentAmount from "./studentAmountFormatter";

const transactionFilterOptions = [
  { label: "Last 7 Days", value: 7, unit: "days" },
  { label: "Last 15 Days", value: 15, unit: "days" },
  { label: "Last 1 Month", value: 1, unit: "months" },
  { label: "Last 3 Months", value: 3, unit: "months" },
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
    `Vendor/Description: ${transaction.vendor}`,
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

function StudentTransactionsPage({ student, onLogout }) {
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [rawTransactions, setRawTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("cpacToken");
    if (!token) return;

    getMyTransactions(token)
      .then((data) => {
        if (data.success) {
          setRawTransactions(data.transactions || []);
        }
      })
      .catch((err) => console.error("Error loading transactions:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const formattedTransactions = useMemo(() => {
    const currentUserId = student.id || student._id;
    return rawTransactions.map((t) => {
      const isTopup = t.type === "wallet_topup";
      const isRefund = t.type === "refund";
      const isPayment = t.type === "payment";

      let amountStr = "";
      if (isTopup) {
        amountStr = formatStudentAmount(Number(t.amount || 0), { includeSign: true });
      } else if (isPayment) {
        if (t.student?._id === currentUserId || t.student === currentUserId) {
          amountStr = formatStudentAmount(Number(t.amount || 0), { includeSign: true, negative: true });
        } else {
          amountStr = formatStudentAmount(Number(t.amount || 0), { includeSign: true });
        }
      } else if (isRefund) {
        amountStr = formatStudentAmount(Number(t.amount || 0), { includeSign: true });
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
  }, [rawTransactions, student.id, student._id]);

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

  const displayedTransactions = useMemo(
    () => visibleTransactions.slice(0, visibleCount),
    [visibleTransactions, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(10);
  }, [searchQuery, selectedFilter]);

  const handleLoadMoreTransactions = () => {
    if (loadingMore || visibleCount >= visibleTransactions.length) {
      return;
    }

    setLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount((count) => Math.min(count + 10, visibleTransactions.length));
      setLoadingMore(false);
    }, 200);
  };

  const handleHistoryScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 20) {
      handleLoadMoreTransactions();
    }
  };

  const handleFilterSelect = (option) => {
    setSelectedFilter(option);
    setIsFilterOpen(false);
  };

  const handleExport = () => {
    if (!dateFilteredTransactions.length) {
      return;
    }

    const rows = dateFilteredTransactions.map((transaction) => {
      const rawTransaction = rawTransactions.find((item) => item._id === transaction.id) || {};
      const createdAt = rawTransaction.createdAt ? new Date(rawTransaction.createdAt) : new Date(`${transaction.date} ${transaction.time}`);

      return {
        Date: createdAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        Time: createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        "Transaction ID": transaction.id,
        "Transaction Type": rawTransaction.type || "",
        Amount: Number(rawTransaction.amount ?? 0),
        Status: rawTransaction.status ? rawTransaction.status.charAt(0).toUpperCase() + rawTransaction.status.slice(1) : transaction.status,
        Description: rawTransaction.description || transaction.vendor || "",
        "Vendor/Student": rawTransaction.vendor?.name || rawTransaction.student?.name || transaction.vendor || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 16 },
      { wch: 28 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 30 },
      { wch: 26 },
    ];

    const headerStyle = {
      font: { bold: true },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "EAF2F8" } },
      border: {
        top: { style: "thin" },
        right: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
      },
    };

    ["A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1"].forEach((cell) => {
      if (worksheet[cell]) {
        worksheet[cell].s = headerStyle;
      }
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

    const fileName = `transactions-${(selectedFilter?.label || "all").toLowerCase().replaceAll(" ", "-")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleReceiptDownload = (transaction) => {
    const blob = createPdfBlob(`Transaction Receipt - ${transaction.id}`, getTransactionPdfRows([transaction]));
    downloadBlob(blob, `receipt-${transaction.id.toLowerCase()}.pdf`);
  };

  const emptyMessage = selectedFilter
    ? "No transactions found for selected period."
    : "No transactions found.";

  return (
    <section className="transaction-history-view" aria-label="Transaction history">
      <div className="history-tools">
        <form className="history-search" onSubmit={(event) => event.preventDefault()}>
          <Icon type="search" />
          <input
            type="search"
            placeholder="Search by transaction ID..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </form>
        <div className="history-filter-menu">
          <button
            className={`history-tool-button${isFilterOpen ? " active" : ""}`}
            type="button"
            aria-expanded={isFilterOpen}
            aria-haspopup="menu"
            onClick={() => setIsFilterOpen((isOpen) => !isOpen)}
          >
            <Icon type="filter" />
            {selectedFilter ? `Date Range: ${selectedFilter.label}` : "Date Range"}
          </button>
          {isFilterOpen && (
            <div className="history-filter-dropdown" role="menu">
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
        <button className="history-export-button" type="button" onClick={handleExport}>
          <Icon type="download" />
          Export
        </button>
      </div>

      <div className="history-table" onScroll={handleHistoryScroll}>
        <table>
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Vendor/Description</th>
              <th>Amount</th>
              <th>Date &amp; Time</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="history-empty-message" colSpan="6" style={{ textAlign: "center", color: "#7c8497", padding: "24px 0" }}>
                  Loading transactions...
                </td>
              </tr>
            ) : displayedTransactions.length ? (
              displayedTransactions.map((transaction) => (
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
                  <td>
                    <span className="status-pill">{transaction.status}</span>
                  </td>
                  <td>
                    <button
                      className="receipt-button"
                      type="button"
                      onClick={() => handleReceiptDownload(transaction)}
                    >
                      <Icon type="download" />
                      Receipt
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="history-empty-message" colSpan="6">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {loadingMore && (
              <tr>
                <td className="history-empty-message" colSpan="6" style={{ textAlign: "center", color: "#7c8497", padding: "16px 0" }}>
                  Loading more transactions...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default StudentTransactionsPage;
