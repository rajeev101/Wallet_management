import { useEffect, useState } from "react";
import "./App.css";
import AdminDashboardPage from "./page/AdminDashboardPage";
import AdminLoginPage from "./page/AdminLoginPage";
import AccessDeniedPage from "./page/AccessDeniedPage";

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
  const [page, setPage] = useState(() => {
    const pathPage = pathPages[window.location.pathname];
    const token = localStorage.getItem("cpacToken");
    const accountType = localStorage.getItem("cpacUserType");

    if (pathPage) {
      return pathPage;
    }

    if (!token) {
      return "admin-login";
    }

    return accountType === "admin" ? "admin-dashboard" : "denied";
  });

  const navigate = (nextPage) => {
    const token = localStorage.getItem("cpacToken");
    const accountType = localStorage.getItem("cpacUserType");
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
            ? "http://localhost:3000/vendor/dashboard"
            : "http://localhost:3000/student/dashboard";
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

    window.history.pushState({}, "", pagePaths[resolvedPage] || "/login");
    setPage(resolvedPage);
  };

  useEffect(() => {
    const handlePopState = () => {
      setPage(pathPages[window.location.pathname] || "admin-login");
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const token = localStorage.getItem("cpacToken");
  const accountType = localStorage.getItem("cpacUserType");

  if (page === "admin-dashboard" && (!token || accountType !== "admin")) {
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
