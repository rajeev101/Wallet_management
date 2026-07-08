import { useEffect, useState } from "react";
import "./App.css";
import LoginPage from "./page/LoginPage";
import RegisterPage from "./page/RegisterPage";
import ForgotPasswordPage from "./page/ForgotPasswordPage";
import VerifyOTPPage from "./page/VerifyOTPPage";
import ResetPasswordPage from "./page/ResetPasswordPage";
import StudentDashboardPage from "./page/StudentDashboardPage";
import VendorDashboardPage from "./page/VendorDashboardPage";

const pagePaths = {
  login: "/login",
  register: "/register",
  forgot: "/forgot-password",
  "verify-otp": "/verify-otp",
  reset: "/reset-password",
  dashboard: "/student/dashboard",
  "vendor-dashboard": "/vendor/dashboard",
};

const pathPages = Object.entries(pagePaths).reduce((acc, [page, path]) => {
  acc[path] = page;
  return acc;
}, {});

const getDashboardPage = (accountType) => {
  if (accountType === "vendor") {
    return "vendor-dashboard";
  }

  return "dashboard";
};

function App() {
  const [page, setPage] = useState(() => {
    const pathPage = pathPages[window.location.pathname];
    const token = localStorage.getItem("cpacToken");
    const accountType = localStorage.getItem("cpacUserType");

    if (pathPage) {
      return pathPage;
    }

    if (!token) {
      return "login";
    }

    return getDashboardPage(accountType);
  });
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");

  const navigate = (nextPage) => {
    const accountType = localStorage.getItem("cpacUserType");
    let resolvedPage = nextPage;

    if (nextPage === "dashboard") {
      resolvedPage = getDashboardPage(accountType);
    }

    window.history.pushState({}, "", pagePaths[resolvedPage] || "/login");
    setPage(resolvedPage);
  };

  useEffect(() => {
    const handlePopState = () => {
      setPage(pathPages[window.location.pathname] || "login");
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const token = localStorage.getItem("cpacToken");

  if ((page === "dashboard" || page === "vendor-dashboard") && !token) {
    return <LoginPage setPage={navigate} />;
  }

  switch (page) {
    case "register":
      return <RegisterPage setPage={navigate} />;

    case "forgot":
      return <ForgotPasswordPage setPage={navigate} setForgotPasswordEmail={setForgotPasswordEmail} />;

    case "verify-otp":
      return <VerifyOTPPage setPage={navigate} forgotPasswordEmail={forgotPasswordEmail} />;

    case "reset":
      return <ResetPasswordPage setPage={navigate} forgotPasswordEmail={forgotPasswordEmail} />;

    case "dashboard":
      return <StudentDashboardPage setPage={navigate} />;

    case "vendor-dashboard":
      return <VendorDashboardPage setPage={navigate} />;

    default:
      return <LoginPage setPage={navigate} />;
  }
}

export default App;
