import Logo from "./Logo";

function AuthBanner() {
  return (
    <div className="auth-banner">
      <Logo variant="light" />

      <h1>
        Welcome to Campus
        <br />
        Payment System
      </h1>

      <p>
        Fast, secure and convenient
        digital payments for campus.
      </p>

      <div className="feature">
        <span className="feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 3 5 6v5c0 4.3 2.7 8.1 7 10 4.3-1.9 7-5.7 7-10V6l-7-3Z" />
          </svg>
        </span>
        <div>
          <h3>Bank-Level Security</h3>
          <p>256-bit encryption protects every transaction</p>
        </div>
      </div>

      <div className="feature">
        <span className="feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="8" y="3" width="8" height="18" rx="2" />
            <path d="M11 18h2" />
          </svg>
        </span>
        <div>
          <h3>Instant Payments</h3>
          <p>Quick QR-based transactions across campus</p>
        </div>
      </div>

      <div className="feature">
        <span className="feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m4 16 5-5 4 4 7-7" />
            <path d="M16 8h4v4" />
          </svg>
        </span>
        <div>
          <h3>Real-Time Analytics</h3>
          <p>Track spending with detailed insights</p>
        </div>
      </div>

    </div>
  );
}

export default AuthBanner;
