import { useState } from "react";
import { adminLogin } from "../api/auth";
import Button from "../components/common/Button";
import InputField from "../components/common/InputField";
import Logo from "../components/common/Logo";
import PasswordInput from "../components/common/PasswordInput";

function AdminLoginPage({ setPage }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    if (!form.email.trim() || !form.password.trim()) {
      setStatus("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await adminLogin(form);
      const safeUser = { ...(data.user || {}) };
      delete safeUser.password;

      if (safeUser.accountType !== "admin") {
        setStatus("Access denied. Admin credentials are required.");
        localStorage.removeItem("cpacToken");
        localStorage.removeItem("cpacUserType");
        localStorage.removeItem("cpacUser");
        return;
      }

      localStorage.setItem("cpacToken", data.token);
      localStorage.setItem("cpacUserType", "admin");
      localStorage.setItem("cpacUser", JSON.stringify(safeUser));
      setPage("admin-dashboard");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <Logo />
        <form className="auth-form" onSubmit={handleSubmit}>
          <h1>Admin Login</h1>
          <p>Secure access for system administrators.</p>

          <InputField
            label="Email Address"
            name="email"
            type="email"
            placeholder="admin@example.com"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
          />

          <PasswordInput
            label="Password"
            name="password"
            placeholder="Enter admin password"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
          />

          <Button text={isSubmitting ? "Signing In..." : "Sign In as Admin"} disabled={isSubmitting} />

          {status && <p className="form-status">{status}</p>}

          <p className="switch-text">
            Student or vendor?
            <button
              className="link-button"
              type="button"
              onClick={() => {
                window.location.href = "http://localhost:3000/login";
              }}
            >
              Use regular login
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

export default AdminLoginPage;
