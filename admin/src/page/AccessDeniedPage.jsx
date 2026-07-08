function AccessDeniedPage({ setPage }) {
  const handleLogout = () => {
    localStorage.removeItem("cpacToken");
    localStorage.removeItem("cpacUserType");
    localStorage.removeItem("cpacUser");
    setPage("login");
  };

  return (
    <main className="access-denied-page">
      <section className="access-denied-card">
        <span>403</span>
        <h1>Access Denied</h1>
        <p>You do not have permission to open this admin area.</p>
        <div>
          <button type="button" onClick={() => setPage("dashboard")}>
            Go to dashboard
          </button>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </section>
    </main>
  );
}

export default AccessDeniedPage;
