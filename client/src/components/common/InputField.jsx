function InputField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  name,
  autoComplete,
  required = true,
  icon = type === "email" ? "mail" : "user",
}) {
  return (
    <div className="input-group">
      <label htmlFor={name}>{label}</label>

      <div className="input-box">
        <FieldIcon name={icon} />
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
        />
      </div>
    </div>
  );
}

function FieldIcon({ name }) {
  const paths = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  };

  return (
    <span className="field-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">{paths[name]}</svg>
    </span>
  );
}

export default InputField;
