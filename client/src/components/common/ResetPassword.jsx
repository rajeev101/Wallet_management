import { useState } from "react";
import PasswordInput from "./PasswordInput";
import Button from "./Button";
import { resetPassword } from "../../api/auth";

function ResetPassword({ setPage, email }) {
  const [form, setForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    // Validation
    if (!form.newPassword || !form.confirmPassword) {
      setStatus("All fields are required");
      return;
    }

    if (form.newPassword.length < 8) {
      setStatus("Password must be at least 8 characters long");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setStatus("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword({
        email,
        newPassword: form.newPassword,
      });
      setStatus("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        setPage("login");
      }, 1500);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <button
        className="back-button"
        type="button"
        onClick={() => setPage("login")}
      >
        <span aria-hidden="true">←</span>
        Back to Login
      </button>

      <h1>Reset Password</h1>

      <p>Create a new password for your account</p>

      <PasswordInput
        label="New Password"
        name="newPassword"
        placeholder="Enter new password"
        value={form.newPassword}
        onChange={handleChange}
        autoComplete="new-password"
      />

      <PasswordInput
        label="Confirm Password"
        name="confirmPassword"
        placeholder="Confirm your password"
        value={form.confirmPassword}
        onChange={handleChange}
        autoComplete="new-password"
      />

      <Button text={isSubmitting ? "Resetting..." : "Reset Password"} disabled={isSubmitting} />

      {status && <p className="form-status">{status}</p>}
    </form>
  );
}

export default ResetPassword;
