import { useState } from "react";
import { changePassword } from "../../api/auth";
import PasswordInput from "./PasswordInput";

export default function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const handleChange = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword.length < 8 || form.newPassword !== form.confirmPassword) {
      setMessage("Use at least 8 characters and matching new passwords.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const data = await changePassword(form, sessionStorage.getItem("cpacToken"));
      setMessage(data.message);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="profile-settings-card">
      <form className="auth-form" onSubmit={submit}>
        <h2>Change Password</h2>
        <PasswordInput label="Current Password" name="currentPassword" value={form.currentPassword} onChange={handleChange} autoComplete="current-password" />
        <PasswordInput label="New Password" name="newPassword" value={form.newPassword} onChange={handleChange} autoComplete="new-password" />
        <PasswordInput label="Confirm New Password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} autoComplete="new-password" />
        <button className="profile-primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Change Password"}</button>
        {message && <p role="status">{message}</p>}
      </form>
    </article>
  );
}