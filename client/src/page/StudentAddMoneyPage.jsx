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
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [hasMoreRequests, setHasMoreRequests] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const requestListRef = useRef(null);
  const requestSentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const nextPageRef = useRef(1);
  const loadedRequestIdsRef = useRef(new Set());
  const historyErrorRef = useRef(false);

  const token = sessionStorage.getItem("cpacToken");
  const batchSize = 5;

  const loadRequests = async ({ reset = false } = {}) => {
    if (loadingRef.current || (!reset && !hasMoreRef.current)) return;
    if (!token) {
      setHistoryError("Your session has expired. Please log in again.");
      setHistoryLoading(false);
      return;
    }

    loadingRef.current = true;
    if (reset) {
      setHistoryLoading(true);
      setHistoryError("");
      historyErrorRef.current = false;
      nextPageRef.current = 1;
      hasMoreRef.current = true;
      setHasMoreRequests(true);
    } else {
      setLoadingMore(true);
      setHistoryError("");
    }

    try {
      const page = reset ? 1 : nextPageRef.current;
      const res = await getWalletRequests(token, page, batchSize);
      if (!res.success) throw new Error(res.message || "Unable to load request history.");

      const batch = res.requests || [];
      if (reset) {
        loadedRequestIdsRef.current = new Set(batch.map((item) => item._id || item.id));
        setRequests(batch);
        if (requestListRef.current) requestListRef.current.scrollTop = 0;
      } else {
        const uniqueBatch = batch.filter((item) => {
          const id = item._id || item.id;
          if (!id || loadedRequestIdsRef.current.has(id)) return false;
          loadedRequestIdsRef.current.add(id);
          return true;
        });
        if (uniqueBatch.length) setRequests((current) => [...current, ...uniqueBatch]);
        if (!uniqueBatch.length && batch.length) hasMoreRef.current = false;
      }
      nextPageRef.current = page + 1;
      hasMoreRef.current = hasMoreRef.current && Boolean(res.hasMore) && batch.length > 0;
      setHasMoreRequests(hasMoreRef.current);
      historyErrorRef.current = false;
      setHistoryError("");
    } catch (err) {
      console.error("Failed to load wallet requests:", err);
      historyErrorRef.current = true;
      setHistoryError(err.message || "Failed to load request history.");
    } finally {
      loadingRef.current = false;
      if (reset) setHistoryLoading(false);
      else setLoadingMore(false);
    }
  };

  const loadMoreRef = useRef(null);
  loadMoreRef.current = () => {
    if (!historyErrorRef.current) loadRequests();
  };

  const retryHistoryLoad = () => {
    historyErrorRef.current = false;
    if (requests.length) loadRequests();
    else loadRequests({ reset: true });
  };

  useEffect(() => {
    const list = requestListRef.current;
    const sentinel = requestSentinelRef.current;
    if (!list) return undefined;

    const handleScroll = () => {
      if (list.scrollHeight - list.scrollTop - list.clientHeight <= 100) {
        loadMoreRef.current?.();
      }
    };
    list.addEventListener("scroll", handleScroll, { passive: true });

    const observer = sentinel && "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current?.();
      }, { root: list, rootMargin: "0px 0px 100px 0px" })
      : null;
    if (observer) observer.observe(sentinel);

    loadRequests({ reset: true });
    if (refreshProfile) {
      refreshProfile();
    }

    return () => {
      list.removeEventListener("scroll", handleScroll);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const list = requestListRef.current;
    if (historyLoading || loadingMore || historyError || !hasMoreRequests || !list) return undefined;
    if (list.scrollHeight - list.clientHeight <= 100) {
      const frame = window.requestAnimationFrame(() => loadMoreRef.current?.());
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [requests.length, historyLoading, loadingMore, historyError, hasMoreRequests]);

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
        await loadRequests({ reset: true });
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
          <div className="request-list" ref={requestListRef} tabIndex={0} aria-label="Request history">
            {historyLoading ? (
              <div className="request-list-loading" role="status"><span className="request-list-spinner" />Loading requests...</div>
            ) : requests.length > 0 ? (
              requests.map((req) => (
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
            {loadingMore && <div className="request-list-loading" role="status"><span className="request-list-spinner" />Loading more requests...</div>}
            {!historyLoading && historyError && (
              <div className="request-list-error" role="alert">
                <span>{historyError}</span>
                <button type="button" onClick={retryHistoryLoad}>Retry</button>
              </div>
            )}
            {!historyLoading && !historyError && requests.length > 0 && !hasMoreRequests && (
              <div className="request-list-end">No more requests</div>
            )}
            <div className="request-list-sentinel" ref={requestSentinelRef} aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default StudentAddMoneyPage;
