import InputField from "../common/InputField";
import PasswordInput from "../common/PasswordInput";
import Button from "../common/Button";
import { useState } from "react";
import { signupUser } from "../../api/auth";

function RegisterForm({ setPage }) {
  const [accountType, setAccountType] = useState("student");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
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

    if (form.password !== form.confirmPassword) {
      setStatus("Password and confirm password do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await signupUser({
        name: form.name,
        email: form.email,
        password: form.password,
        accountType,
      });
      setStatus("Account created. You can sign in now.");
      setPage("login");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Create Account</h1>

      <InputField
        label="Full Name"
        name="name"
        placeholder="John Doe"
        value={form.name}
        onChange={handleChange}
        autoComplete="name"
      />

      <InputField
        label="Email Address"
        name="email"
        type="email"
        placeholder="student@university.edu"
        value={form.email}
        onChange={handleChange}
        autoComplete="email"
      />

      <label className="field-label">Account Type</label>

      <div className="account-type">
        <button
          className={accountType === "student" ? "active" : ""}
          type="button"
          onClick={() => setAccountType("student")}
        >
          Student
        </button>
        <button
          className={accountType === "vendor" ? "active" : ""}
          type="button"
          onClick={() => setAccountType("vendor")}
        >
          Vendor
        </button>
      </div>

      <PasswordInput
        label="Password"
        name="password"
        placeholder="Create a password"
        value={form.password}
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

      <Button text={isSubmitting ? "Creating..." : "Create Account"} disabled={isSubmitting} />

      {status && <p className="form-status">{status}</p>}

      <p className="switch-text">
        Already have an account?
        <button
          className="link-button"
          type="button"
          onClick={() => setPage("login")}
        >
          Sign In
        </button>
      </p>
    </form>
  );
}

export default RegisterForm;
