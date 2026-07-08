import Logo from "../components/common/Logo";
import VerifyOTP from "../components/common/VerifyOTP";

function VerifyOTPPage({ setPage, forgotPasswordEmail }) {
  return (
    <div className="auth-page">
      <Logo />
      <div className="auth-card compact-card">
        <VerifyOTP setPage={setPage} email={forgotPasswordEmail} />
      </div>
    </div>
  );
}

export default VerifyOTPPage;
