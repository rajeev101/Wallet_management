import Logo from "../components/common/Logo";
import ResetPassword from "../components/common/ResetPassword";

function ResetPasswordPage({ setPage, forgotPasswordEmail }) {
  return (
    <div className="auth-page">
      <Logo />
      <div className="auth-card compact-card">
        <ResetPassword setPage={setPage} email={forgotPasswordEmail} />
      </div>
    </div>
  );
}

export default ResetPasswordPage;
