import { useState } from "react";
import { loginUser } from "../../api/auth";
import InputField from "../common/InputField";
import PasswordInput from "../common/PasswordInput";
import Button from "../common/Button";

function LoginForm({ setPage }) {
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
    setIsSubmitting(true);

    sessionStorage.removeItem("cpacToken");
    sessionStorage.removeItem("cpacUserType");
    sessionStorage.removeItem("cpacUser");

    try {
      const data = await loginUser(form);
      const safeUser = { ...(data.user || {}) };
      delete safeUser.password;
      sessionStorage.setItem("cpacToken", data.token);
      sessionStorage.setItem("cpacUserType", safeUser.accountType || "student");
      sessionStorage.setItem("cpacUser", JSON.stringify(safeUser));
      setStatus("Login successful.");
      setPage(
        safeUser.accountType === "vendor"
            ? "vendor-dashboard"
            : "dashboard"
      );
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Sign In</h1>

      <InputField
        label="Email Address"
        name="email"
        type="email"
        placeholder="Enter your email address"
        value={form.email}
        onChange={handleChange}
        autoComplete="email"
      />

      <PasswordInput
        label="Password"
        name="password"
        placeholder="Enter your password"
        value={form.password}
        onChange={handleChange}
        autoComplete="current-password"
      />

      <div className="row">
        <label>
          <input type="checkbox" />
          Remember me
        </label>

        <button
          className="link-button"
          type="button"
          onClick={() => setPage("forgot")}
        >
          Forgot Password?
        </button>
      </div>

      <Button text={isSubmitting ? "Signing In..." : "Sign In"} disabled={isSubmitting} />

      {status && <p className="form-status">{status}</p>}

      <p className="switch-text">
        Don't have an account?
        <button
          className="link-button"
          type="button"
          onClick={() => setPage("register")}
        >
          Create Account
        </button>
      </p>

    </form>
  );
}

export default LoginForm;
