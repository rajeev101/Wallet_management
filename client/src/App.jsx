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

  return accountType === "student" ? "dashboard" : "login";
};

function App() {
  const [authStatus, setAuthStatus] = useState(() =>
    sessionStorage.getItem("cpacToken") ? "loading" : "unauthenticated"
  );
  const [authUser, setAuthUser] = useState(null);
  const [page, setPage] = useState(() => {
    const pathPage = pathPages[window.location.pathname];
    const token = sessionStorage.getItem("cpacToken");
    const accountType = sessionStorage.getItem("cpacUserType");

    if (!token) {
      return pathPage && !["dashboard", "vendor-dashboard"].includes(pathPage)
        ? pathPage
        : "login";
    }

    const dashboardPage = getDashboardPage(accountType);
    return ["dashboard", "vendor-dashboard", "login"].includes(pathPage)
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
      if (!user || !["student", "vendor"].includes(user.accountType)) throw new Error("Invalid account");
      sessionStorage.setItem("cpacUserType", user.accountType);
      sessionStorage.setItem("cpacUser", JSON.stringify(user));
      setAuthUser(user);
      setAuthStatus("authenticated");
      const desiredPage = getDashboardPage(user.accountType);
      if (page === "dashboard" || page === "vendor-dashboard") {
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
        currentPage === "dashboard" || currentPage === "vendor-dashboard"
          ? "login"
          : currentPage
      );
    });
    return () => { active = false; };
  }, [authStatus, page]);

  const navigate = (nextPage) => {
    const accountType = sessionStorage.getItem("cpacUserType");
    let resolvedPage = nextPage;

    if (nextPage === "dashboard" || nextPage === "vendor-dashboard") {
      resolvedPage = getDashboardPage(accountType);
      if (["dashboard", "vendor-dashboard"].includes(resolvedPage)) {
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

    if (resolvedPage === "login") {
      sessionStorage.removeItem("cpacToken");
      sessionStorage.removeItem("cpacUserType");
      sessionStorage.removeItem("cpacUser");
      setAuthUser(null);
      setAuthStatus("unauthenticated");
    }

    const nextPath = pagePaths[resolvedPage] || "/login";
    if (resolvedPage === "dashboard" && window.location.pathname === pagePaths.login) {
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
      setPage(pathPages[window.location.pathname] || "login");
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const token = sessionStorage.getItem("cpacToken");

  if (token && authStatus === "loading") {
    return <div role="status" aria-live="polite">Loading your account…</div>;
  }

  if ((page === "dashboard" || page === "vendor-dashboard") && (!token || authStatus !== "authenticated")) {
    return <LoginPage setPage={navigate} />;
  }

  if ((page === "dashboard" && authUser?.accountType !== "student") ||
      (page === "vendor-dashboard" && authUser?.accountType !== "vendor")) {
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
