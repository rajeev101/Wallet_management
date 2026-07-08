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
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const clearAdminStorage = () => {
    localStorage.removeItem("cpacToken");
    localStorage.removeItem("cpacUserType");
    localStorage.removeItem("cpacUser");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    const email = form.email.trim();
    const password = form.password.trim();

    if (!email || !password) {
      setStatus("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await adminLogin({ email, password });

      // Validate API response
      if (!data || !data.token || !data.user) {
        throw new Error("Invalid response from server.");
      }

      const safeUser = { ...data.user };
      delete safeUser.password;

      // Support both role and accountType from backend
      const userType = safeUser.role || safeUser.accountType;

      if (userType !== "admin") {
        clearAdminStorage();
        setStatus("Access denied. Admin credentials are required.");
        return;
      }

      localStorage.setItem("cpacToken", data.token);
      localStorage.setItem("cpacUserType", "admin");
      localStorage.setItem("cpacUser", JSON.stringify(safeUser));

      setPage("admin-dashboard");
    } catch (error) {
      clearAdminStorage();
      setStatus(error?.message || "Admin login failed. Please try again.");
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

          <Button
            text={isSubmitting ? "Signing In..." : "Sign In as Admin"}
            disabled={isSubmitting}
          />

          {status && <p className="form-status">{status}</p>}

          <p className="switch-text">
            Student or vendor?{" "}
            <button
              className="link-button"
              type="button"
              onClick={() => setPage("login")}
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