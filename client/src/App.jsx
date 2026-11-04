import { useEffect, useState } from "react";
import "./App.css";
import LoginPage from "./page/LoginPage";
import RegisterPage from "./page/RegisterPage";
import ForgotPasswordPage from "./page/ForgotPasswordPage";
import VerifyOTPPage from "./page/VerifyOTPPage";
import ResetPasswordPage from "./page/ResetPasswordPage";
import StudentDashboardPage from "./page/StudentDashboardPage";
import VendorDashboardPage from "./page/VendorDashboardPage";
import { getProfile } from "./api/auth";

const pagePaths = {
  login: "/login",
  register: "/register",
  "customer-login": "/customer/login",
  "customer-dashboard": "/customer/dashboard",
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
  if (accountType === "customer") return "customer-dashboard";
  if (accountType === "vendor") {
    return "vendor-dashboard";
  }

  return accountType === "student" ? "dashboard" : "login";
};
const dashboardPages = ["dashboard", "customer-dashboard", "vendor-dashboard"];

const getCurrentPathPage = () => {
  // Old bookmarks use the shared registration form, not a separate Customer page.
  if (window.location.pathname === "/customer/register") {
    window.history.replaceState({}, "", pagePaths.register);
    return "register";
  }
  return pathPages[window.location.pathname];
};

function App() {
  const [authStatus, setAuthStatus] = useState(() =>
    sessionStorage.getItem("cpacToken") ? "loading" : "unauthenticated"
  );
  const [authUser, setAuthUser] = useState(null);
  const [page, setPage] = useState(() => {
    const pathPage = getCurrentPathPage();
    const token = sessionStorage.getItem("cpacToken");
    const accountType = sessionStorage.getItem("cpacUserType");

    if (!token) {
      return pathPage && !dashboardPages.includes(pathPage)
        ? pathPage
        : "login";
    }

    const dashboardPage = getDashboardPage(accountType);
    return [...dashboardPages, "login", "customer-login"].includes(pathPage)
      ? dashboardPage
      : pathPage || dashboardPage;
  });
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem("cpacToken");
    // A fresh login has already provided a verified profile. Only revalidate
    // sessions restored from storage; page changes must not race that login.
    if (!token || authStatus === "authenticated") {
      return () => { active = false; };
    }
    getProfile(token).then(({ user }) => {
      if (!active) return;
      if (!user || !["student", "customer", "vendor"].includes(user.accountType)) throw new Error("Invalid account");
      sessionStorage.setItem("cpacUserType", user.accountType);
      sessionStorage.setItem("cpacUser", JSON.stringify(user));
      setAuthUser(user);
      setAuthStatus("authenticated");
      const desiredPage = getDashboardPage(user.accountType);
      if (dashboardPages.includes(page)) {
        if (page !== desiredPage || window.location.pathname !== pagePaths[desiredPage]) {
          window.history.replaceState({}, "", pagePaths[desiredPage]);
          setPage(desiredPage);
        }
      }
    }).catch(() => {
      if (!active) return;
      sessionStorage.removeItem("cpacToken");
      sessionStorage.removeItem("cpacUserType");
      sessionStorage.removeItem("cpacUser");
      setAuthUser(null);
      setAuthStatus("unauthenticated");
      setPage((currentPage) =>
        dashboardPages.includes(currentPage)
          ? "login"
          : currentPage
      );
    });
    return () => { active = false; };
  }, [authStatus, page]);

  const navigate = (nextPage) => {
    const accountType = sessionStorage.getItem("cpacUserType");
    let resolvedPage = nextPage;

    if (dashboardPages.includes(nextPage)) {
      resolvedPage = getDashboardPage(accountType);
      if (dashboardPages.includes(resolvedPage)) {
        try {
          const user = JSON.parse(sessionStorage.getItem("cpacUser") || "null");
          if (user?.accountType === accountType) {
            setAuthUser(user);
            setAuthStatus("authenticated");
          }
        } catch {
          setAuthUser(null);
        }
      }
    }

    if (["login", "customer-login"].includes(resolvedPage)) {
      sessionStorage.removeItem("cpacToken");
      sessionStorage.removeItem("cpacUserType");
      sessionStorage.removeItem("cpacUser");
      setAuthUser(null);
      setAuthStatus("unauthenticated");
    }

    const nextPath = pagePaths[resolvedPage] || "/login";
    if (resolvedPage === "customer-dashboard" && window.location.pathname === pagePaths["customer-login"]) {
      window.history.replaceState({ customerView: "dashboard" }, "", nextPath);
    } else if (resolvedPage === "dashboard" && window.location.pathname === pagePaths.login) {
      // Replace the login entry so Back does not return to the login screen
      // immediately after a successful Student sign-in.
      window.history.replaceState({ studentView: "dashboard" }, "", nextPath);
    } else if (resolvedPage === "vendor-dashboard" && window.location.pathname === pagePaths.login) {
      // Keep the Vendor login entry from becoming the immediate Back destination.
      window.history.replaceState({ vendorView: "dashboard" }, "", nextPath);
    } else {
      window.history.pushState({}, "", nextPath);
    }
    setPage(resolvedPage);
  };

  useEffect(() => {
    const handlePopState = () => {
      setPage(getCurrentPathPage() || "login");
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const token = sessionStorage.getItem("cpacToken");

  if (token && authStatus === "loading") {
    return <div role="status" aria-live="polite">Loading your account…</div>;
  }

  if (dashboardPages.includes(page) && (!token || authStatus !== "authenticated")) {
    return <LoginPage setPage={navigate} accountType={page === "customer-dashboard" ? "customer" : undefined} />;
  }

  if ((page === "dashboard" && authUser?.accountType !== "student") ||
      (page === "customer-dashboard" && authUser?.accountType !== "customer") ||
      (page === "vendor-dashboard" && authUser?.accountType !== "vendor")) {
    return <LoginPage setPage={navigate} />;
  }

  const recoveryNavigate = (nextPage) => navigate(nextPage === "login" && sessionStorage.getItem("cpacRecoveryRole") === "customer" ? "customer-login" : nextPage);

  switch (page) {
    case "customer-login":
      return <LoginPage key="customer-login" setPage={navigate} accountType="customer" />;
    case "register":
      return <RegisterPage setPage={navigate} />;

    case "forgot":
      return <ForgotPasswordPage setPage={recoveryNavigate} setForgotPasswordEmail={setForgotPasswordEmail} />;

    case "verify-otp":
      return <VerifyOTPPage setPage={recoveryNavigate} forgotPasswordEmail={forgotPasswordEmail} />;

    case "reset":
      return <ResetPasswordPage setPage={recoveryNavigate} forgotPasswordEmail={forgotPasswordEmail} />;

    case "dashboard":
      return <StudentDashboardPage setPage={navigate} />;
    case "customer-dashboard":
      return <StudentDashboardPage key="customer-dashboard" setPage={navigate} role="customer" />;

    case "vendor-dashboard":
      return <VendorDashboardPage setPage={navigate} />;

    default:
      return <LoginPage setPage={navigate} />;
  }
}

export default App;
