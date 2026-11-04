import InputField from "../common/InputField";
import PasswordInput from "../common/PasswordInput";
import Button from "../common/Button";
import { useState } from "react";
import { signupUser } from "../../api/auth";

function RegisterForm({ setPage }) {
  const [accountType, setAccountType] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    student_id: "",
    samagra_id: "",
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

    if (!accountType) {
      setStatus("Please select an account type.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setStatus("Password and confirm password do not match.");
      return;
    }

    const identityField = accountType === "student" ? "student_id" : "samagra_id";
    if (!form[identityField].trim()) {
      setStatus(accountType === "student" ? "Student ID is required." : "Samagra ID is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      await signupUser({
        name: form.name,
        email: form.email,
        password: form.password,
        accountType,
        [identityField]: form[identityField].trim(),
      });
      setStatus("Account created. You can sign in now.");
      setPage(accountType === "customer" ? "customer-login" : "login");
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
        placeholder="Enter your full name"
        value={form.name}
        onChange={handleChange}
        autoComplete="name"
      />

      <InputField
        label="Email Address"
        name="email"
        type="email"
        placeholder="Enter your email address"
        value={form.email}
        onChange={handleChange}
        autoComplete="email"
      />

      <label className="field-label">Account Type</label>

      <div className="account-type">
        <button
          className={accountType === "student" ? "active" : ""}
          type="button"
          aria-pressed={accountType === "student"}
          onClick={() => setAccountType("student")}
        >
          Student
        </button>
        <button
          className={accountType === "customer" ? "active" : ""}
          type="button"
          aria-pressed={accountType === "customer"}
          onClick={() => setAccountType("customer")}
        >
          Customer
        </button>
      </div>

      {accountType && (
        <InputField
          key={accountType}
          label={accountType === "student" ? "Student ID" : "Samagra ID"}
          name={accountType === "student" ? "student_id" : "samagra_id"}
          placeholder={accountType === "student" ? "Enter your student ID" : "Enter your Samagra ID"}
          value={accountType === "student" ? form.student_id : form.samagra_id}
          onChange={handleChange}
          autoComplete="off"
        />
      )}

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
          onClick={() => setPage(accountType === "customer" ? "customer-login" : "login")}
        >
          Sign In
        </button>
      </p>
    </form>
  );
}

export default RegisterForm;
