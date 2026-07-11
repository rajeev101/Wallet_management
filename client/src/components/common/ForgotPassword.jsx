import { useState } from "react";
import InputField from "../common/InputField";
import Button from "../common/Button";
import { forgotPassword } from "../../api/auth";

function ForgotPassword({ setPage, setForgotPasswordEmail }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");
    
    if (!email) {
      setStatus("Email is required");
      return;
    }

    setIsSubmitting(true);

    try {
      await forgotPassword({ email });
      setForgotPasswordEmail(email);
      setStatus("OTP sent to your email. Redirecting...");
      setTimeout(() => {
        setPage("verify-otp");
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

      <h1>Forgot Password?</h1>

      <p>
        Enter your email and we'll send you a code to reset your password
      </p>

      <InputField
        label="Email Address"
        name="email"
        type="email"
        placeholder="student@university.edu"
        value={email}
        onChange={handleChange}
        autoComplete="email"
      />

      <Button text={isSubmitting ? "Sending..." : "Send Reset Code"} disabled={isSubmitting} />

      {status && <p className="form-status">{status}</p>}
    </form>
  );
}

export default ForgotPassword;
