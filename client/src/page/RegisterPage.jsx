import Logo from "../components/common/Logo";
import RegisterForm from "../components/common/RegisterForm";

function RegisterPage({ setPage }) {
  return (
    <div className="auth-page">
      <Logo />
      <div className="auth-card">
        <RegisterForm setPage={setPage} />
      </div>
    </div>
  );
}

export default RegisterPage;
