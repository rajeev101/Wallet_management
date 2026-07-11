function Button({ text, type = "submit", disabled = false }) {
  return (
    <button className="primary-btn" type={type} disabled={disabled}>
      {text}
    </button>
  );
}

export default Button;
