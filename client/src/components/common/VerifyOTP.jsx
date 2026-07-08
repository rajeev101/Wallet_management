import { useEffect, useRef, useState } from "react";
import Button from "./Button";
import { forgotPassword, verifyOtp } from "../../api/auth";

const OTP_TIMER_SECONDS = 5 * 60;

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
};

function VerifyOTP({ setPage, email }) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(OTP_TIMER_SECONDS);
  const inputRefs = useRef([]);
  const resendDisabled = secondsRemaining > 0 || isResending;

  useEffect(() => {
    if (secondsRemaining <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSecondsRemaining((currentSeconds) => Math.max(currentSeconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [secondsRemaining]);

  const handleChange = (value, index) => {
    if (value.match(/^[0-9]?$/)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Auto-focus next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setStatus("Please enter all 6 digits");
      return;
    }

    setIsSubmitting(true);

    try {
      await verifyOtp({ email, otp: otpString });
      setStatus("OTP verified successfully. Redirecting...");
      setTimeout(() => {
        setPage("reset");
      }, 1500);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendDisabled) {
      return;
    }

    setIsResending(true);
    setResendMessage("Sending new OTP...");
    
    try {
      await forgotPassword({ email });
      setOtp(["", "", "", "", "", ""]);
      setSecondsRemaining(OTP_TIMER_SECONDS);
      setResendMessage("New OTP sent to your email!");
      inputRefs.current[0]?.focus();
    } catch (error) {
      setResendMessage(error.message || "Failed to resend OTP");
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    if (!resendMessage || isResending) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setResendMessage("");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [isResending, resendMessage]);

  if (!email) {
    return (
      <div className="auth-form">
        <button
          className="back-button"
          type="button"
          onClick={() => setPage("forgot")}
        >
          <span aria-hidden="true">←</span>
          Back
        </button>
        <h1>Verify Code</h1>
        <p>Please request a reset code first.</p>
        <button className="primary-btn" type="button" onClick={() => setPage("forgot")}>
          Send Reset Code
        </button>
      </div>
    );
  }

  const timerText = secondsRemaining > 0
    ? `Code expires in ${formatTime(secondsRemaining)}`
    : "Code expired. Resend OTP is now active.";

  const resendText = isResending ? "Sending..." : "Resend OTP";
  const displayedResendMessage = resendMessage
    || (secondsRemaining === 0 ? "Code expired. You can resend OTP now." : "");

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

      <h1>Verify Code</h1>

      <p>We sent a 6-digit code to {email}</p>

      <div className="otp-inputs">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength="1"
            value={digit}
            onChange={(e) => handleChange(e.target.value, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className="otp-input"
            placeholder="0"
            autoComplete="off"
          />
        ))}
      </div>

      <Button text={isSubmitting ? "Verifying..." : "Verify Code"} disabled={isSubmitting} />

      <p className={`otp-timer ${secondsRemaining === 0 ? "expired" : ""}`}>
        {timerText}
      </p>

      {status && <p className="form-status">{status}</p>}

      <div className="resend-section">
        <p>Didn't receive the code?</p>
        <button
          type="button"
          className="link-button"
          onClick={handleResendOtp}
          disabled={resendDisabled}
        >
          {resendText}
        </button>
        {displayedResendMessage && (
          <p className={`resend-message ${isResending ? "loading" : "success"}`}>
            {displayedResendMessage}
          </p>
        )}
      </div>
    </form>
  );
}

export default VerifyOTP;
