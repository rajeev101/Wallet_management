import { useEffect, useRef, useState } from "react";
import { Icon } from "./StudentIcon";
import StudentHeader from "./StudentHeader";
import { createWalletRequest, getWalletRequests } from "../api/auth";

const formatDate = (dateString) => {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + " at " + d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};

const getStatusLabel = (status) => {
  if (status === "completed") return "Approved";
  if (status === "failed") return "Rejected";
  return "Pending";
};

const getStatusClass = (status) => {
  if (status === "completed") return "approved";
  if (status === "failed") return "rejected";
  return "pending";
};

const formatDisplayAmount = (value) => {
  const numericValue = Number(value ?? 0);
  const absValue = Math.abs(numericValue);
  return `₹${Number.isInteger(absValue) ? String(absValue) : absValue.toFixed(2).replace(/\.00$/, "")}`;
};

function StudentAddMoneyPage({ student, onLogout, refreshProfile }) {
  const [topUpAmount, setTopUpAmount] = useState("");
  const [requests, setRequests] = useState([]);
  const [visibleRequests, setVisibleRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const requestListRef = useRef(null);

  const token = sessionStorage.getItem("cpacToken");
  const batchSize = 5;

  const loadRequests = async () => {
    try {
      if (!token) return;
      const res = await getWalletRequests(token);
      if (res.success) {
        const allRequests = res.requests || [];
        setRequests(allRequests);
        setVisibleRequests(allRequests.slice(0, batchSize));
      }
    } catch (err) {
      console.error("Failed to load wallet requests:", err);
    }
  };

  const handleLoadMoreRequests = () => {
    if (loadingMore || visibleRequests.length >= requests.length) {
      return;
    }

    setLoadingMore(true);
    window.setTimeout(() => {
      const nextVisibleCount = Math.min(visibleRequests.length + batchSize, requests.length);
      setVisibleRequests(requests.slice(0, nextVisibleCount));
      setLoadingMore(false);
    }, 200);
  };

  const handleRequestListScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 20) {
      handleLoadMoreRequests();
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      loadRequests();
    });
    if (refreshProfile) {
      refreshProfile();
    }
  }, []);

  const sanitizeTopUpAmount = (value) => value.replace(/\D/g, "").slice(0, 10);

  const handleSubmit = async () => {
    setSuccessMessage("");
    setErrorMessage("");

    const parsedAmount = Number(topUpAmount);
    if (!/^\d{1,10}$/.test(topUpAmount) || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Please enter a valid amount greater than 0");
      return;
    }

    try {
      setLoading(true);
      if (!token) {
        setErrorMessage("Authentication token is missing. Please log in again.");
        return;
      }

      const res = await createWalletRequest({ amount: parsedAmount }, token);
      if (res.success) {
        setSuccessMessage("Your add money request has been submitted to the admin.");
        setTopUpAmount("");
        await loadRequests();
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="add-money-view" aria-label="Add money request">
      <div className="add-money-content">
        <div className="add-money-card">
          <h2>Request Add Money</h2>
          <label htmlFor="topUpAmount">Amount to Add</label>
          <div className="amount-field add-money-input">
            <span>₹</span>
            <input
              id="topUpAmount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(sanitizeTopUpAmount(event.target.value))}
              onPaste={(event) => {
                const pastedValue = event.clipboardData.getData("text") || "";
                const sanitizedPaste = sanitizeTopUpAmount(pastedValue);

                if (!/^\d*$/.test(pastedValue) || sanitizedPaste.length !== pastedValue.replace(/\D/g, "").length) {
                  event.preventDefault();
                }

                if (pastedValue && /^\d*$/.test(pastedValue)) {
                  const nextValue = sanitizeTopUpAmount(`${topUpAmount}${pastedValue}`);
                  event.preventDefault();
                  setTopUpAmount(nextValue);
                }
              }}
              onKeyDown={(event) => {
                const invalidKeys = ["e", "E", "+", "-", ".", ","]; 
                if (invalidKeys.includes(event.key) || (event.key === " " && !event.ctrlKey && !event.metaKey)) {
                  event.preventDefault();
                }
              }}
              disabled={loading}
            />
          </div>
          <div className="current-balance-panel">
            <span>Current Balance</span>
            <strong>{formatDisplayAmount(student?.walletBalance || 0)}</strong>
          </div>
          {errorMessage && <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: "8px 0" }}>{errorMessage}</p>}
          {successMessage && <p style={{ color: "#10b981", fontSize: "0.85rem", margin: "8px 0" }}>{successMessage}</p>}
          <button
            className="pay-now-button submit-request-button"
            type="button"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </div>

        <div className="request-history-card">
          <h2>Request History</h2>
          <div className="request-list" ref={requestListRef} onScroll={handleRequestListScroll}>
            {visibleRequests.length > 0 ? (
              visibleRequests.map((req) => (
                <article key={req._id || req.id} className="request-item">
                  <div>
                    <strong>{formatDisplayAmount(req.amount)}</strong>
                    <span>
                      <Icon type="clock" />
                      {formatDate(req.createdAt)}
                    </span>
                  </div>
                  <em className={`request-status ${getStatusClass(req.status)}`}>
                    {getStatusLabel(req.status)}
                  </em>
                </article>
              ))
            ) : (
              <p style={{ color: "#7c8497", fontSize: "0.85rem", textAlign: "center", padding: "16px 0" }}>
                No request history found.
              </p>
            )}
            {loadingMore && <div className="request-list-loading">Loading...</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default StudentAddMoneyPage;
