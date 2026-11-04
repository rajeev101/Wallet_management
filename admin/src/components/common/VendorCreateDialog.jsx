import { useEffect, useRef, useState } from "react";
import { createVendor } from "../../api/admin";

export default function VendorCreateDialog({ onClose, onCreated }) {
  const dialogRef = useRef(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", active: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await createVendor(form);
      onCreated(data.message);
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  };

  return (
    <dialog className="vendor-create-dialog" ref={dialogRef} aria-labelledby="vendor-create-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <header className="dashboard-modal-header">
        <div><h2 id="vendor-create-title">Create Vendor</h2><p>Secure onboarding, managed by an administrator.</p></div>
        <button className="dashboard-modal-close" type="button" aria-label="Close vendor creation" disabled={busy} onClick={onClose}>×</button>
      </header>
      <form className="vendor-create-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>Shop name<input autoFocus required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="organization" /></label>
          <label>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" /></label>
          <label>Phone number<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} autoComplete="tel" /></label>
          <label className="vendor-active-option"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Activate account immediately</label>
        </fieldset>
        <p>A secure temporary password will be generated and emailed to the vendor. Inactive vendors cannot sign in or receive payments.</p>
        {error && <p className="admin-alert error" role="alert">{error}</p>}
        <div className="admin-profile-form-actions">
          <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy}>{busy ? "Sending onboarding email…" : "Create Vendor & Send Email"}</button>
        </div>
      </form>
    </dialog>
  );
}