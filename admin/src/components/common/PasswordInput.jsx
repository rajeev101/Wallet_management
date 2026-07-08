import { useState } from "react";

function PasswordInput({
  label,
  placeholder,
  value,
  onChange,
  name,
  autoComplete,
  required = true,
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="input-group">
      <label htmlFor={name}>{label}</label>

      <div className="password-box">
        <span className="field-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>

        <input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
        />

        <button
          aria-label={show ? "Hide password" : "Show password"}
          type="button"
          onClick={() => setShow(!show)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default PasswordInput;
