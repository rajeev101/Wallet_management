import { useEffect, useRef, useState } from "react";
import { getDevices, getDevice, getDeviceHistory, getDeviceAttempts, resetDevice } from "../../api/admin";

const date = value => value ? new Date(value).toLocaleString() : "Not available";
const role = user => user.accountType === "customer" ? "Customer" : "Student";
const accountId = user => user.accountType === "customer" ? user.samagra_id || user._id : user.student_id || user._id;

export default function DeviceManagementSection({ Icon }) {
  const [filters, setFilters] = useState({ search: "", role: "", status: "", sort: "name", direction: "asc", page: 1, limit: 20 });
  const [search, setSearch] = useState("");
  const [result, setResult] = useState({ devices: [], total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    getDevices(filters).then(data => { if (current) { setResult(data); setError(""); } })
      .catch(failure => { if (current) setError(failure.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [filters, revision]);
  const change = (key, value) => { setLoading(true); setFilters(previous => ({ ...previous, [key]: value, page: key === "page" ? value : 1 })); };
  const refresh = () => { setLoading(true); setRevision(previous => previous + 1); };
  return <section className="device-management" aria-label="Device Management">
    <form className="device-toolbar" onSubmit={event => { event.preventDefault(); change("search", search.trim()); }}>
      <label className="device-search">Search accounts<input value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder="Name, email, phone or user ID" /></label>
      <button type="submit">Search</button>
      <label>Account type<select value={filters.role} onChange={event => change("role", event.target.value)}><option value="">All accounts</option><option value="student">Student</option><option value="customer">Customer</option></select></label>
      <label>Binding status<select value={filters.status} onChange={event => change("status", event.target.value)}><option value="">All states</option><option value="locked">Locked</option><option value="unbound">Unbound</option></select></label>
      <label>Sort by<select value={filters.sort} onChange={event => change("sort", event.target.value)}><option value="name">Name</option><option value="registeredAt">Registration date</option><option value="lastLoginAt">Last login</option></select></label>
      <label>Order<select value={filters.direction} onChange={event => change("direction", event.target.value)}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
      <button type="button" disabled={loading} onClick={refresh}>Refresh</button>
    </form>
    {message && <p className="admin-alert success" role="status">{message}</p>}
    {error && <p className="admin-alert error" role="alert">{error} <button type="button" onClick={refresh}>Retry</button></p>}
    <p className="device-result-count" aria-live="polite">{loading ? "Loading devices..." : `${result.total} accounts`}</p>
    <div className="admin-table-wrap device-table" aria-busy={loading}><table><thead><tr>
      <th>Account</th><th>Registered device</th><th>Platform / Versions</th><th>Registered / Last login</th><th>Status</th><th>Actions</th>
    </tr></thead><tbody>
      {result.devices.map(user => <tr key={user._id}>
        <td><strong>{user.name}</strong><span>{role(user)} · {accountId(user)}</span><span>{user.email}</span><span>{user.phone || "No phone number"}</span></td>
        <td><strong>{user.device?.name || "No registered device"}</strong><span>{user.device?.id || "Not bound"}</span></td>
        <td><span>{user.device?.platform || "Not available"}</span><span>OS: {user.device?.osVersion || "-"}</span><span>App: {user.device?.appVersion || "-"}</span></td>
        <td><span>{date(user.device?.registeredAt)}</span><span>{date(user.device?.lastLoginAt)}</span></td>
        <td><span className={`device-state ${user.lockStatus}`}>{user.lockStatus === "locked" ? "Locked" : "Unbound"}</span></td>
        <td><div className="device-actions"><button type="button" onClick={() => setSelected({ id: user._id, reset: false })}>View Details</button><button type="button" className="device-danger" onClick={() => setSelected({ id: user._id, reset: true })}>Reset Device</button></div></td>
      </tr>)}
      {!loading && !result.devices.length && <tr><td colSpan={6}>No accounts match these filters.</td></tr>}
    </tbody></table></div>
    <div className="device-pagination"><button type="button" title="Previous page" aria-label="Previous page" disabled={loading || filters.page === 1} onClick={() => change("page", filters.page - 1)}><Icon type="chevron" /></button><span>Page {filters.page}</span><button type="button" title="Next page" aria-label="Next page" disabled={loading || !result.hasMore} onClick={() => change("page", filters.page + 1)}><span className="device-next"><Icon type="chevron" /></span></button></div>
    {selected && <DeviceDetailsDialog key={selected.id} userId={selected.id} initialReset={selected.reset} onClose={() => setSelected(null)} onReset={text => { setMessage(text); refresh(); }} />}
  </section>;
}

function DeviceDetailsDialog({ userId, initialReset, onClose, onReset }) {
  const dialogRef = useRef(null);
  const [details, setDetails] = useState(null);
  const [history, setHistory] = useState({ history: [], hasMore: false });
  const [attempts, setAttempts] = useState({ attempts: [], hasMore: false });
  const [tab, setTab] = useState("details");
  const [pages, setPages] = useState({ history: 1, attempts: 1 });
  const [confirmReset, setConfirmReset] = useState(initialReset);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => { const dialog = dialogRef.current; dialog.showModal(); return () => dialog.close(); }, []);
  useEffect(() => {
    let current = true;
    Promise.all([getDevice(userId), getDeviceHistory(userId, pages.history), getDeviceAttempts(userId, pages.attempts)])
      .then(([deviceData, historyData, attemptData]) => { if (current) { setDetails(deviceData.user); setHistory(historyData); setAttempts(attemptData); setError(""); } })
      .catch(failure => { if (current) setError(failure.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [userId, pages, revision]);
  const reload = () => { setLoading(true); setRevision(value => value + 1); };
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await resetDevice(userId, reason.trim(), details.authVersion); onReset(result.message); onClose(); }
    catch (failure) { setError(failure.message); setBusy(false); }
  };
  const nextAuditPage = delta => { setLoading(true); setPages(previous => ({ ...previous, [tab]: previous[tab] + delta })); };
  return <dialog ref={dialogRef} className="vendor-create-dialog device-dialog" aria-labelledby="device-details-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="dashboard-modal-header"><div><h2 id="device-details-title">{confirmReset ? "Reset Device" : "Device Details"}</h2><p>{details?.name || "Account device management"}</p></div><button type="button" className="dashboard-modal-close" aria-label="Close device details" disabled={busy} onClick={onClose}>×</button></header>
    <div className="device-dialog-body">
      {error && <p className="admin-alert error" role="alert">{error} <button type="button" disabled={busy} onClick={reload}>Reload Details</button></p>}
      {loading && <p role="status">Loading device details...</p>}
      {details && !loading && (confirmReset ? <form className="device-reset-form" onSubmit={submit}>
        <p>Reset the registered device for <strong>{details.name}</strong>? All existing sessions will be revoked. The next mobile login will register a device and lock this account again.</p>
        <label htmlFor="device-reset-reason">Reset reason<textarea id="device-reset-reason" autoFocus required minLength={10} maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
        <div className="device-actions"><button type="button" disabled={busy} onClick={() => setConfirmReset(false)}>Cancel Reset</button><button type="submit" className="device-danger" disabled={busy || reason.trim().length < 10}>{busy ? "Resetting..." : "Reset Device"}</button></div>
      </form> : <>
        <div className="device-tabs" role="tablist" aria-label="Device information">{[["details", "Details"], ["attempts", "Blocked Attempts"], ["history", "Reset History"]].map(([key, label]) => <button key={key} id={`device-tab-${key}`} type="button" role="tab" aria-selected={tab === key} aria-controls="device-tab-panel" onClick={() => setTab(key)}>{label}</button>)}</div>
        <div role="tabpanel" id="device-tab-panel" aria-labelledby={`device-tab-${tab}`}>
          {tab === "details" && <><dl className="device-details">{[
            ["User name", details.name], ["User ID", accountId(details)], ["Database ID", details._id], ["Email", details.email], ["Mobile number", details.phone], ["User type", role(details)],
            ["Device name", details.device?.name], ["Device ID", details.device?.id], ["Platform", details.device?.platform], ["OS version", details.device?.osVersion], ["App version", details.device?.appVersion],
            ["Registration date", date(details.device?.registeredAt)], ["Last login", date(details.device?.lastLoginAt)], ["Lock status", details.lockStatus === "locked" ? "Locked" : "Unbound (locking enabled)"],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not available"}</dd></div>)}</dl><button type="button" className="device-danger" onClick={() => setConfirmReset(true)}>Reset Device</button></>}
          {tab === "history" && <div className="device-audit-list">{history.history.map(entry => <article key={entry._id}><strong>{date(entry.resetAt)} · {entry.adminName}</strong><p>{entry.reason}</p><small>Admin ID: {entry.performedBy}</small><p>Previous device: {entry.previousDevice?.name || "Unbound"} {entry.previousDevice?.id || ""}</p></article>)}{!history.history.length && <p>No device resets recorded.</p>}</div>}
          {tab === "attempts" && <div className="device-audit-list">{attempts.attempts.map(entry => <article key={entry._id}><strong>{date(entry.createdAt)}</strong><p>{entry.device?.name || "Browser or missing device"} · {entry.device?.platform || "Not available"}</p><p>{entry.device?.id || "No device identifier"}</p><small>{entry.code}</small></article>)}{!attempts.attempts.length && <p>No blocked login attempts recorded.</p>}</div>}
          {tab !== "details" && <div className="device-pagination"><button type="button" disabled={pages[tab] === 1} onClick={() => nextAuditPage(-1)}>Previous</button><span>Page {pages[tab]}</span><button type="button" disabled={!(tab === "history" ? history : attempts).hasMore} onClick={() => nextAuditPage(1)}>Next</button></div>}
        </div>
      </>)}
    </div>
  </dialog>;
}