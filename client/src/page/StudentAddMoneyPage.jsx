import { useCallback, useEffect, useState } from "react";
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

function StudentAddMoneyPage({ student, onLogout, refreshProfile }) {
  const [topUpAmount, setTopUpAmount] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const token = localStorage.getItem("cpacToken");

  const loadRequests = useCallback(async () => {
    try {
      if (!token) return;
      const res = await getWalletRequests(token);
      if (res.success) {
        setRequests(res.requests || []);
      }
    } catch (err) {
      console.error("Failed to load wallet requests:", err);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadRequests();
      refreshProfile?.();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadRequests, refreshProfile]);

  const handleSubmit = async () => {
    setSuccessMessage("");
    setErrorMessage("");

    const parsedAmount = Number(topUpAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
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
      <StudentHeader
        title="Add Money"
        student={student}
        onLogout={onLogout}
      />

      <div className="add-money-content">
        <div className="add-money-card">
          <h2>Request Add Money</h2>
          <label htmlFor="topUpAmount">Amount to Add</label>
          <div className="amount-field add-money-input">
            <span>$</span>
            <input
              id="topUpAmount"
              min="0.01"
              step="0.01"
              type="number"
              placeholder="0.00"
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="current-balance-panel">
            <span>Current Balance</span>
            <strong>${Number(student?.walletBalance || 0).toFixed(2)}</strong>
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
          <div className="request-list">
            {requests.length > 0 ? (
              requests.map((req) => (
                <article key={req._id || req.id} className="request-item">
                  <div>
                    <strong>{`$${Number(req.amount).toFixed(2)}`}</strong>
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
          </div>
        </div>
      </div>
    </section>
  );
}

export default StudentAddMoneyPage;
