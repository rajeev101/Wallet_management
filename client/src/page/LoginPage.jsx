import AuthBanner from "../components/common/AuthBanner";
import LoginForm from "../components/common/LoginForm";

function LoginPage({ setPage }) {
  return (
    <div className="login-container">
      <AuthBanner />

      <div className="form-section">
        <LoginForm setPage={setPage} />
      </div>
    </div>
  );
}

export default LoginPage;
