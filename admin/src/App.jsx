import { useEffect, useRef, useState } from "react";
import "./App.css";
import AdminDashboardPage from "./page/AdminDashboardPage";
import AdminLoginPage from "./page/AdminLoginPage";
import AccessDeniedPage from "./page/AccessDeniedPage";
import { getProfile } from "./api/auth";

const getPrefix = () => (window.location.pathname.startsWith("/admin") ? "/admin" : "");

const getCleanPath = (pathname) => {
  const withoutPrefix = pathname.replace(/^\/admin/, "");
  return withoutPrefix || "/";
};

const pagePaths = {
  "admin-login": "/login",
  "admin-dashboard": "/dashboard",
  denied: "/access-denied",
};

const pathPages = Object.entries(pagePaths).reduce((acc, [page, path]) => {
  acc[path] = page;
  return acc;
}, {});

function App() {
  const [authStatus, setAuthStatus] = useState(() =>
    sessionStorage.getItem("cpacToken") ? "loading" : "unauthenticated"
  );
  const [page, setPage] = useState(() => {
    const cleanPath = getCleanPath(window.location.pathname);
    const pathPage = pathPages[cleanPath];
    const token = sessionStorage.getItem("cpacToken");
    const accountType = sessionStorage.getItem("cpacUserType");

    if (pathPage) {
      return pathPage;
    }

    if (!token) {
      return "admin-login";
    }

    return accountType === "admin" ? "admin-dashboard" : "denied";
  });
  const pageRef = useRef(page);

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem("cpacToken");
    if (!token) {
      return () => { active = false; };
    }
    getProfile(token).then(({ user }) => {
      if (!active) return;
      if (!user) throw new Error("Invalid session");
      sessionStorage.setItem("cpacUser", JSON.stringify(user));
      sessionStorage.setItem("cpacUserType", user.accountType);
      if (user.accountType !== "admin") {
        setAuthStatus("denied");
        return;
      }
      setAuthStatus("authenticated");
      if (page === "admin-dashboard") return;
      const cleanPath = getCleanPath(window.location.pathname);
      if (cleanPath === "/") {
        window.history.replaceState({}, "", `${getPrefix()}${pagePaths["admin-dashboard"]}`);
        setPage("admin-dashboard");
      }
    }).catch(() => {
      if (!active) return;
      sessionStorage.removeItem("cpacToken");
      sessionStorage.removeItem("cpacUserType");
      sessionStorage.removeItem("cpacUser");
      setAuthStatus("unauthenticated");
      if (page === "admin-dashboard") setPage("admin-login");
    });
    return () => { active = false; };
  }, [page]);

  const navigate = (nextPage) => {
    const token = sessionStorage.getItem("cpacToken");
    const accountType = sessionStorage.getItem("cpacUserType");
    let resolvedPage = nextPage;

    if (nextPage === "login") {
      resolvedPage = "admin-login";
    }

    if (nextPage === "dashboard") {
      if (accountType === "admin") {
        resolvedPage = "admin-dashboard";
      } else {
        window.location.href =
          accountType === "vendor"
            ? "/vendor/dashboard"
            : "/student/dashboard";
        return;
      }
    }

    if (nextPage === "admin-dashboard") {
      if (!token) {
        resolvedPage = "admin-login";
      } else if (accountType !== "admin") {
        resolvedPage = "denied";
      }
    }

    const prefix = getPrefix();
    const targetPath = pagePaths[resolvedPage] || "/login";
    const historyState = resolvedPage === "admin-dashboard"
      ? { adminView: "dashboard", adminRoute: resolvedPage }
      : { adminRoute: resolvedPage };
    if (resolvedPage === "admin-dashboard" && pageRef.current === "admin-login") {
      window.history.replaceState(historyState, "", `${prefix}${targetPath}`);
    } else {
      window.history.pushState(historyState, "", `${prefix}${targetPath}`);
    }
    setPage(resolvedPage);
    pageRef.current = resolvedPage;
  };

  useEffect(() => {
    const handlePopState = () => {
      const cleanPath = getCleanPath(window.location.pathname);
      const nextPage = pathPages[cleanPath] || "admin-login";
      setPage(nextPage);
      pageRef.current = nextPage;
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const token = sessionStorage.getItem("cpacToken");
  const accountType = sessionStorage.getItem("cpacUserType");

  if (token && authStatus === "loading") {
    return <div role="status" aria-live="polite">Loading your account…</div>;
  }

  if (authStatus === "denied" || (page === "admin-dashboard" && token && accountType !== "admin")) {
    return <AccessDeniedPage setPage={navigate} />;
  }

  if (page === "admin-dashboard" && (!token || authStatus !== "authenticated")) {
    return token ? <AccessDeniedPage setPage={navigate} /> : <AdminLoginPage setPage={navigate} />;
  }

  switch (page) {
    case "admin-dashboard":
      return <AdminDashboardPage setPage={navigate} />;

    case "denied":
      return <AccessDeniedPage setPage={navigate} />;

    default:
      return <AdminLoginPage setPage={navigate} />;
  }
}

export default App;
