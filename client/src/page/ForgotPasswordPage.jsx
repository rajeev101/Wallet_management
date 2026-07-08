import Logo from "../components/common/Logo";
import ForgotPassword from "../components/common/ForgotPassword";

function ForgotPasswordPage({ setPage, setForgotPasswordEmail }) {
  return (
    <div className="auth-page">
      <Logo />
      <div className="auth-card compact-card">
        <ForgotPassword setPage={setPage} setForgotPasswordEmail={setForgotPasswordEmail} />
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
