function Logo({ variant = "dark" }) {
  return (
    <div className={`logo ${variant === "light" ? "logo-light" : ""}`}>
      <div className="logo-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v2H6.5A2.5 2.5 0 0 1 4 6.5v11A2.5 2.5 0 0 0 6.5 20H20a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 1 4 6.5v1Z" />
          <path d="M17 14h2" />
        </svg>
      </div>

      <div>
        <h2>Campus Wallet</h2>
        <p>Secure Campus Payments</p>
      </div>
    </div>
  );
}

export default Logo;
