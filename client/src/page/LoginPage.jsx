import AuthBanner from "../components/common/AuthBanner";
import LoginForm from "../components/common/LoginForm";

function LoginPage({ setPage, accountType }) {
  return (
    <div className="login-page-shell">
      <div className="login-container">
        <AuthBanner />

        <div className="form-section">
          <LoginForm setPage={setPage} accountType={accountType} />
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
