import { useCallback, useEffect, useRef, useState } from "react";
import {
  approveVendor,
  getAdminStats,
  getAdminStudents,
  getAdminTransactions,
  getAdminVendors,
  rejectVendor,
  getAdminWalletRequests,
  updateWalletRequestStatus,
  getNotifications,
  clearNotifications,
} from "../api/admin";
import { getProfile, updateProfile } from "../api/auth";

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value || 0));
const formatMoney = (value) => `₹${formatNumber(Math.round(Number(value || 0)))}`;

const fallbackTransactions = [
  ["TXN001", "John Doe", "Campus Cafe", "₹12.50", "Completed", "2 mins ago"],
  ["TXN002", "Jane Smith", "Library Store", "₹8.00", "Completed", "5 mins ago"],
  ["TXN003", "Mike Johnson", "Sports Shop", "₹25.00", "Pending", "10 mins ago"],
  ["TXN004", "Sarah Williams", "Campus Cafe", "₹15.75", "Completed", "15 mins ago"],
];

const fallbackStudents = [
  {
    _id: "STU12345",
    name: "John Doe",
    email: "john.doe@university.edu",
    phone: "+1 234 567 8900",
    walletBalance: 245.8,
  },
  {
    _id: "STU12346",
    name: "Jane Smith",
    email: "jane.smith@university.edu",
    phone: "+1 234 567 8901",
    walletBalance: 180.5,
  },
  {
    _id: "STU12347",
    name: "Mike Johnson",
    email: "mike.johnson@university.edu",
    phone: "+1 234 567 8902",
    walletBalance: 92,
  },
  {
    _id: "STU12348",
    name: "Sarah Williams",
    email: "sarah.williams@university.edu",
    phone: "+1 234 567 8903",
    walletBalance: 320.75,
  },
];

const fallbackVendors = [
  {
    _id: "V001",
    name: "Campus Cafe",
    owner: "Robert Brown",
    email: "cafe@campus.edu",
    phone: "+1 234 567 8900",
    vendorStatus: "approved",
    totalSales: 12450,
  },
  {
    _id: "V002",
    name: "Library Store",
    owner: "Emma Wilson",
    email: "library@campus.edu",
    phone: "+1 234 567 8901",
    vendorStatus: "approved",
    totalSales: 8320,
  },
  {
    _id: "V003",
    name: "Sports Shop",
    owner: "James Davis",
    email: "sports@campus.edu",
    phone: "+1 234 567 8902",
    vendorStatus: "rejected",
    totalSales: 5670,
  },
];

const getStoredAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("cpacUser") || "{}");
  } catch {
    return {};
  }
};

const buildProfileForm = (user = {}) => ({
  name: user.name || "Admin User",
  email: user.email || "admin@campuswallet.com",
  phone: user.phone || "",
  photo: user.profilePicture || "",
  accountStatus: user.accountStatus || "Active",
  joinDate:
    user.joinDate ||
    (user.createdAt
      ? new Date(user.createdAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })),
});

const getNameInitials = (name = "Admin User") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "AU";
  }

  const firstInitial = parts[0].charAt(0);
  const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0) : parts[0].charAt(1);

  return `${firstInitial}${lastInitial || ""}`.toUpperCase();
};

function AdminDashboardPage({ setPage }) {
  const [activeView, setActiveView] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState({ text: "", view: "" });
  const [error, setError] = useState({ text: "", view: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [walletRequests, setWalletRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [transactionTab, setTransactionTab] = useState("student");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [dashboardModal, setDashboardModal] = useState(null);
  const [selectedDashboardItem, setSelectedDashboardItem] = useState(null);

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const activeViewRef = useRef(activeView);

  const [admin, setAdmin] = useState(getStoredAdmin);

  const [profileForm, setProfileForm] = useState(() => buildProfileForm(getStoredAdmin()));

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  const clearAlerts = useCallback(() => {
    setMessage({ text: "", view: "" });
    setError({ text: "", view: "" });
  }, []);

  const showMessage = useCallback((text) => {
    setMessage({ text, view: activeViewRef.current });
    setError({ text: "", view: "" });
  }, []);

  const showError = useCallback((text) => {
    setError({ text, view: activeViewRef.current });
    setMessage({ text: "", view: "" });
  }, []);

  useEffect(() => {
    if (!message.text) return undefined;

    const timer = window.setTimeout(() => {
      setMessage((current) => (current === message ? { text: "", view: "" } : current));
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error.text) return undefined;

    const timer = window.setTimeout(() => {
      setError((current) => (current === error ? { text: "", view: "" } : current));
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [error]);

  const loadAdminData = useCallback(async (query = "") => {
    setIsLoading(true);
    setError({ text: "", view: "" });

    try {
      const [statsData, studentsData, vendorsData, transactionsData, walletRequestsData] = await Promise.all([
        getAdminStats(),
        getAdminStudents(query),
        getAdminVendors(query),
        getAdminTransactions(),
        getAdminWalletRequests(),
      ]);

      setStats(statsData.stats);
      setStudents(studentsData.students || []);
      setVendors(vendorsData.vendors || []);
      setTransactions(transactionsData.transactions || []);

      const formattedRequests = (walletRequestsData.requests || []).map((req) => {
        const date = new Date(req.createdAt);
        return {
          id: req._id || req.id,
          student: req.student?.name || "Student",
          studentId: req.student?._id ? `STU${req.student._id.slice(-5).toUpperCase()}` : "STU12345",
          amount: req.amount,
          requestDate: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          requestTime: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          status: req.status === "completed" ? "approved" : req.status === "failed" ? "rejected" : "pending",
        };
      });
      setWalletRequests(formattedRequests);
    } catch (loadError) {
      showError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAdminData("");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAdminData]);

  useEffect(() => {
    const loadProfile = async () => {
      const token = localStorage.getItem("cpacToken");

      if (!token) return;

      try {
        const data = await getProfile(token);
        const safeUser = { ...(data.user || {}) };
        delete safeUser.password;

        setAdmin(safeUser);
        setProfileForm(buildProfileForm(safeUser));
        localStorage.setItem("cpacUser", JSON.stringify(safeUser));
      } catch (profileError) {
        console.error("Failed to load admin profile:", profileError);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("cpacToken")) return undefined;

    const loadNotifications = async () => {
      try {
        const data = await getNotifications();
        setNotifications(data.notifications || []);
      } catch (notificationError) {
        console.error("Failed to load notifications:", notificationError);
      }
    };

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsNotifOpen(false);
        setIsProfileOpen(false);
        setDashboardModal(null);
        setSelectedDashboardItem(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!dashboardModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [dashboardModal]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadAdminData(search);
  };

  const handleVendorStatus = async (vendorId, action) => {
    clearAlerts();

    try {
      const request = action === "approve" ? approveVendor : rejectVendor;
      await request(vendorId);
      showMessage(`Vendor ${action === "approve" ? "approved" : "rejected"} successfully.`);
      await loadAdminData(search);
    } catch (statusError) {
      showError(statusError.message);
    }
  };

  const handleWalletRequestStatus = async (requestId, nextStatus) => {
    clearAlerts();

    try {
      await updateWalletRequestStatus(requestId, { status: nextStatus });
      showMessage(`Money addition request ${nextStatus} successfully.`);
      await loadAdminData(search);
    } catch (statusError) {
      showError(statusError.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("cpacToken");
    localStorage.removeItem("cpacUserType");
    localStorage.removeItem("cpacUser");
    setPage("admin-login");
  };

  const handleClearNotif = async () => {
    try {
      await clearNotifications();
      setNotifications([]);
    } catch (notificationError) {
      console.error("Failed to clear notifications:", notificationError);
    }
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((prev) => ({ ...prev, photo: reader.result }));
      clearAlerts();
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleRemoveProfileImage = () => {
    setProfileForm((prev) => ({ ...prev, photo: "" }));
    clearAlerts();
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    clearAlerts();

    const token = localStorage.getItem("cpacToken");

    if (!token) {
      showError("Please login again to save profile changes.");
      return;
    }

    try {
      const data = await updateProfile(
        {
          name: profileForm.name.trim(),
          email: profileForm.email.trim(),
          phone: profileForm.phone.trim(),
          profilePicture: profileForm.photo,
        },
        token
      );
      const safeUser = { ...(data.user || {}) };
      delete safeUser.password;

      setAdmin(safeUser);
      setProfileForm(buildProfileForm(safeUser));
      localStorage.setItem("cpacUser", JSON.stringify(safeUser));
      setIsEditingProfile(false);
      showMessage("Profile updated successfully.");
    } catch (saveError) {
      showError(saveError.message);
    }
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const statCards = [
    {
      type: "students",
      label: "Total Students",
      value: formatNumber(stats?.totalStudents),
      trend: "12% vs last month",
      icon: "students",
      tone: "blue",
    },
    {
      type: "vendors",
      label: "Total Vendors",
      value: formatNumber(stats?.totalVendors),
      trend: "5% vs last month",
      icon: "store",
      tone: "cyan",
    },
    {
      type: "transactions",
      label: "Total Transactions",
      value: formatNumber(stats?.totalTransactions),
      trend: "18% vs last month",
      icon: "swap",
      tone: "plain",
    },
    {
      type: "wallet",
      label: "Total Wallet Balance",
      value: formatMoney(stats?.totalWalletBalance),
      trend: "8% vs last month",
      icon: "wallet",
      tone: "plain",
    },
  ];

  const recentRows = transactions.length
    ? transactions.slice(0, 4).map((transaction, index) => {
        const statusText = transaction.status || "Completed";
        return [
          `TXN${String(index + 1).padStart(3, "0")}`,
          transaction.student?.name || "-",
          transaction.vendor?.name || "Wallet Top-up",
          formatMoney(transaction.amount),
          <span className={`transaction-status ${String(statusText).toLowerCase()}`}>
            {statusText}
          </span>,
          new Date(transaction.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        ];
      })
    : fallbackTransactions;
  const visibleStudents = students.length ? students : fallbackStudents;
  const filteredStudents = visibleStudents.filter((student, index) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    const studentId = student._id?.startsWith("STU")
      ? student._id
      : `STU${String(index + 12345)}`;

    return [
      student.name,
      student.email,
      student.phone,
      studentId,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });

  const studentTotalBalance = students.length
    ? students.reduce((total, student) => total + Number(student.walletBalance || 0), 0)
    : 125420;
  const averageStudentBalance = visibleStudents.length
    ? studentTotalBalance / visibleStudents.length
    : 0;
  const studentStats = [
    ["Total Students", formatNumber(stats?.totalStudents || visibleStudents.length)],
    ["Active Users", formatNumber(stats?.totalStudents || visibleStudents.length), "green"],
    ["Total Balance", formatMoney(stats?.totalWalletBalance || studentTotalBalance)],
    ["Avg. Balance", `₹${averageStudentBalance.toFixed(2)}`],
  ];
  const visibleVendors = vendors.length ? vendors : fallbackVendors;
  const filteredVendors = visibleVendors.filter((vendor, index) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    const vendorId = vendor._id?.startsWith("V")
      ? vendor._id
      : `V${String(index + 1).padStart(3, "0")}`;

    return [
      vendor.name,
      vendor.owner,
      vendor.email,
      vendor.phone,
      vendorId,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });

  const getVendorSales = (vendor) => {
    if (vendor.totalSales) {
      return Number(vendor.totalSales);
    }

    return transactions.reduce((total, transaction) => {
      const transactionVendorId = transaction.vendor?._id || transaction.vendor;
      const transactionVendorName = transaction.vendor?.name;
      const isVendorMatch = transactionVendorId === vendor._id || transactionVendorName === vendor.name;

      return isVendorMatch ? total + Number(transaction.amount || 0) : total;
    }, 0);
  };
  const getVendorStatusLabel = (status) => {
    if (status === "approved") {
      return "Active";
    }

    if (status === "rejected") {
      return "Inactive";
    }

    return "Pending";
  };

  const pendingWalletRequests = walletRequests.filter((request) => request.status === "pending").length;
  const adminDisplayName = admin.name || "Admin User";
  const adminPhoto = admin.profilePicture || "";
  const adminInitials = getNameInitials(adminDisplayName);

  const filteredTransactions = transactions.filter((transaction) => {
    const type = String(transaction.type || "").toLowerCase();
    const isStudentTransaction = type.includes("student") || type.includes("wallet") || type.includes("topup") || (transaction.student && !transaction.vendor);
    const isVendorTransaction = type.includes("vendor") || type.includes("payment") || type.includes("purchase") || transaction.vendor;

    if (transactionTab === "student") {
      return isStudentTransaction;
    }
    return isVendorTransaction;
  });

  const openDashboardModal = (type) => {
    setSelectedDashboardItem(null);
    setDashboardModal(type);
  };

  const closeDashboardModal = () => {
    setDashboardModal(null);
    setSelectedDashboardItem(null);
  };

  return (
    <div className="admin-dashboard-page">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-icon">
            <AdminIcon type="wallet" />
          </span>
          <div>
            <strong>Campus<br />Wallet</strong>
            <span>Admin Panel</span>
          </div>
          <button type="button" aria-label="Collapse sidebar">
            <AdminIcon type="chevron" />
          </button>
        </div>

        <nav aria-label="Admin dashboard navigation">
          {[
            ["dashboard", "Dashboard", "grid"],
            ["students", "Students", "students"],
            ["vendors", "Vendors", "store"],
            ["transactions", "Transactions", "swap"],
            ["wallet", "Wallet", "wallet"],
            ["profile", "Profile", "user"],
          ].map(([view, label, icon]) => (
            <button
              className={activeView === view ? "active" : ""}
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
            >
              <AdminIcon type={icon} />
              {label}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-logout" type="button" onClick={handleLogout}>
            <AdminIcon type="logout" />
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-navbar">
          <div>
            <h1>
              {activeView === "students"
                ? "Student Management"
                : activeView === "vendors"
                  ? "Vendor Management"
                  : activeView === "wallet"
                    ? "Wallet Management"
                    : activeView === "dashboard"
                      ? "Dashboard"
                      : activeView === "profile" && isEditingProfile
                        ? "Edit Profile"
                      : pageTitle(activeView)}
            </h1>
            <p>{activeView === "students" ? "Manage students and wallet balances" : today}</p>
          </div>

          <div className="admin-navbar-actions">
            <div className="notification-wrapper" ref={notifRef}>
              <button
                className={`notification-button${isNotifOpen ? " active" : ""}`}
                type="button"
                aria-label="Notifications"
                onClick={() => {
                  setIsNotifOpen(!isNotifOpen);
                  setIsProfileOpen(false);
                }}
              >
                <AdminIcon type="bell" />
                {notifications.length > 0 && <span />}
              </button>

              {isNotifOpen && (
                <div className="notification-dropdown">
                  <div className="dropdown-header">
                    <h3>Notifications</h3>
                    {notifications.length > 0 && (
                      <button className="clear-btn" type="button" onClick={handleClearNotif}>
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="notification-list">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div key={notif._id} className="notification-item">
                          <p>{notif.text}</p>
                          <span className="notif-time">{new Date(notif.createdAt).toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="notification-empty">No new notifications</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="profile-wrapper" ref={profileRef}>
              <div
                className="profile-trigger-area"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsNotifOpen(false);
                }}
              >
                <div className="profile-summary">
                  <strong>{adminDisplayName}</strong>
                  <span>Administrator</span>
                </div>
                <span className="profile-avatar">
                  {adminPhoto ? (
                    <img src={adminPhoto} alt={`${adminDisplayName} profile`} />
                  ) : (
                    adminInitials
                  )}
                </span>
              </div>

              {isProfileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-info">
                    <span className="profile-dropdown-avatar">
                      {adminPhoto ? (
                        <img src={adminPhoto} alt={`${adminDisplayName} profile`} />
                      ) : (
                        adminInitials
                      )}
                    </span>
                    <strong>{adminDisplayName}</strong>
                    <span className="email">{admin.email || "admin@campuswallet.com"}</span>
                    <span className="badge">Administrator</span>
                  </div>
                  <div className="profile-dropdown-actions">
                    <button className="logout-btn" type="button" onClick={handleLogout}>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {error.text && error.view === activeView && <p className="admin-alert error">{error.text}</p>}
        {message.text && message.view === activeView && <p className="admin-alert success">{message.text}</p>}

        {isLoading ? (
          <div className="admin-loading">Loading admin data...</div>
        ) : (
          <>
            {activeView === "dashboard" && (
              <>
                <section className="admin-stats-grid" aria-label="Dashboard statistics">
                  {statCards.map((card) => (
                    <article
                      className="admin-stat-card clickable"
                      key={card.label}
                      role="button"
                      tabIndex={0}
                      aria-haspopup="dialog"
                      onClick={() => openDashboardModal(card.type)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openDashboardModal(card.type);
                        }
                      }}
                    >
                      <div>
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                        <em>↑ {card.trend}</em>
                      </div>
                      <span className={`admin-stat-icon ${card.tone}`}>
                        <AdminIcon type={card.icon} />
                      </span>
                    </article>
                  ))}
                </section>

                <section className="admin-recent-section">
                  <div className="admin-section-title">
                    <h2>Recent Transactions</h2>
                    <button type="button" onClick={() => setActiveView("transactions")}>View All</button>
                  </div>
                  <AdminTable
                    columns={["Transaction ID", "Student", "Vendor", "Amount", "Status", "Time"]}
                    rows={recentRows}
                    emptyText="No transactions found."
                  />
                </section>
              </>
            )}

            {activeView === "students" && (
              <>
                <section className="student-management-stats" aria-label="Student statistics">
                  {studentStats.map(([label, value, tone]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <strong className={tone || ""}>{value}</strong>
                    </article>
                  ))}
                </section>

                <section className="student-management-tools" aria-label="Student tools">
                  <form className="student-management-search" onSubmit={handleSearch}>
                    <AdminIcon type="search" />
                    <input
                      type="search"
                      placeholder="Search students by name, email, phone, or ID..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </form>
                  <button
                    className="student-add-button"
                    type="button"
                    onClick={() => showMessage("Students can be added from the signup flow.")}
                  >
                    <span>+</span>
                    Add Student
                  </button>
                </section>

                <section className="student-management-table">
                  <div className="admin-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student ID</th>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Wallet Balance</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student, index) => {
                          const studentId = student._id?.startsWith("STU")
                            ? student._id
                            : `STU${String(index + 12345)}`;

                          return (
                            <tr key={student._id || student.email}>
                              <td>{studentId}</td>
                              <td>
                                <div className="student-name-cell">
                                  <span>
                                    <AdminIcon type="user" />
                                  </span>
                                  <div>
                                    <strong>{student.name}</strong>
                                    <em>{student.email}</em>
                                  </div>
                                </div>
                              </td>
                              <td>{student.phone || "-"}</td>
                              <td className="student-balance">{`₹${Number(student.walletBalance || 0).toFixed(2)}`}</td>
                              <td>
                                <span className="student-active-pill">Active</span>
                              </td>
                              <td>
                                <button
                                  className="student-money-button"
                                  type="button"
                                  onClick={() => setActiveView("wallet")}
                                >
                                  <span>₹</span>
                                  Add Money
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {activeView === "vendors" && (
              <>
                <section className="vendor-management-tools" aria-label="Vendor tools">
                  <form className="vendor-management-search" onSubmit={handleSearch}>
                    <AdminIcon type="search" />
                    <input
                      type="search"
                      placeholder="Search vendors by name, email, phone, or ID..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </form>
                  <button
                    className="vendor-add-button"
                    type="button"
                    onClick={() => showMessage("Vendors can be added from the signup flow.")}
                  >
                    <span>+</span>
                    Add Vendor
                  </button>
                </section>

                <section className="vendor-management-table">
                  <div className="admin-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Vendor ID</th>
                          <th>Shop Name</th>
                          <th>Owner</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Total Sales</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVendors.map((vendor, index) => {
                          const statusLabel = getVendorStatusLabel(vendor.vendorStatus);
                          const vendorId = vendor._id?.startsWith("V")
                            ? vendor._id
                            : `V${String(index + 1).padStart(3, "0")}`;

                          return (
                            <tr key={vendor._id || vendor.email}>
                              <td>{vendorId}</td>
                              <td>{vendor.name}</td>
                              <td>{vendor.owner || vendor.name}</td>
                              <td>{vendor.email}</td>
                              <td>{vendor.phone || "-"}</td>
                              <td>
                                <span className={`vendor-status ${statusLabel.toLowerCase()}`}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="vendor-sales">{formatMoney(getVendorSales(vendor))}</td>
                              <td>
                                <div className="vendor-row-actions">
                                  <button
                                    type="button"
                                    aria-label={`Approve ${vendor.name}`}
                                    onClick={() => handleVendorStatus(vendor._id, "approve")}
                                    disabled={vendor._id?.startsWith("V")}
                                  >
                                    <AdminIcon type="edit" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Reject ${vendor.name}`}
                                    onClick={() => handleVendorStatus(vendor._id, "reject")}
                                    disabled={vendor._id?.startsWith("V")}
                                  >
                                    <AdminIcon type="trash" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {activeView === "transactions" && (
              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <h2>Transaction History</h2>
                  <span>{filteredTransactions.length} recent</span>
                </div>
                <div className="transaction-tabs">
                  <button
                    type="button"
                    className={transactionTab === "student" ? "active" : ""}
                    onClick={() => setTransactionTab("student")}
                  >
                    Student Transactions
                  </button>
                  <button
                    type="button"
                    className={transactionTab === "vendor" ? "active" : ""}
                    onClick={() => setTransactionTab("vendor")}
                  >
                    Vendor Transactions
                  </button>
                </div>
                <AdminTable
                  columns={["Student", "Vendor", "Type", "Amount", "Status", "Date"]}
                  rows={filteredTransactions.map((transaction) => {
                    const statusText = transaction.status || "Completed";
                    return [
                      transaction.student?.name || "-",
                      transaction.vendor?.name || "-",
                      transaction.type?.replace("_", " ") || "payment",
                      formatMoney(transaction.amount),
                      <span className={`transaction-status ${String(statusText).toLowerCase()}`}>
                        {statusText}
                      </span>,
                      new Date(transaction.createdAt).toLocaleString(),
                    ];
                  })}
                  emptyText="No transactions found."
                />
              </section>
            )}

            {activeView === "profile" && (
              <section className="admin-profile-page">
                <div className={`admin-profile-grid ${isEditingProfile ? "is-editing" : ""}`}>
                  {!isEditingProfile ? (
                    <section className="admin-panel admin-profile-card">
                      <div className="admin-profile-top">
                        <div className="admin-profile-photo">
                          {profileForm.photo ? (
                            <img src={profileForm.photo} alt="Profile" />
                          ) : (
                            <span>{getNameInitials(profileForm.name)}</span>
                          )}
                        </div>
                        <div>
                          <h2>{profileForm.name}</h2>
                          <span>Administrator</span>
                        </div>
                      </div>
                      <div className="admin-profile-details">
                        <div>
                          <strong>Full Name</strong>
                          <span>{profileForm.name}</span>
                        </div>
                        <div>
                          <strong>Role</strong>
                          <span>Administrator</span>
                        </div>
                        <div>
                          <strong>Email</strong>
                          <span>{profileForm.email}</span>
                        </div>
                        <div>
                          <strong>Phone Number</strong>
                          <span>{profileForm.phone || "Not available"}</span>
                        </div>
                        <div>
                          <strong>Account Status</strong>
                          <span className="admin-profile-status">{profileForm.accountStatus}</span>
                        </div>
                        <div>
                          <strong>Join Date</strong>
                          <span>{profileForm.joinDate}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="admin-profile-edit-button"
                        onClick={() => setIsEditingProfile(true)}
                      >
                        Edit Profile
                      </button>
                    </section>
                  ) : (
                    <section className="admin-panel admin-profile-edit-card">
                      <div className="admin-panel-heading">
                        <h2>Edit Profile</h2>
                        <span>Update your account details</span>
                      </div>
                      <form onSubmit={handleProfileSave} className="admin-profile-form">
                        <div className="admin-profile-edit-photo" aria-label="Profile photo">
                          <label className="admin-profile-photo-upload">
                            <span className="admin-profile-photo">
                              {profileForm.photo ? (
                                <img src={profileForm.photo} alt="Profile" />
                              ) : (
                                <span>{getNameInitials(profileForm.name)}</span>
                              )}
                            </span>
                            <span className="admin-profile-photo-edit-badge" aria-hidden="true">
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M5 19l4.4-1.1L18.2 9 15 5.8l-8.8 8.8L5 19Z" />
                                <path d="M13.8 7 17 10.2" />
                              </svg>
                            </span>
                            <input type="file" accept="image/*" onChange={handleProfileImage} />
                          </label>
                          {profileForm.photo && (
                            <button className="admin-profile-photo-remove" type="button" onClick={handleRemoveProfileImage}>
                              Remove photo
                            </button>
                          )}
                        </div>
                        <label>
                          Full Name
                          <input
                            type="text"
                            name="name"
                            value={profileForm.name}
                            onChange={handleProfileChange}
                          />
                        </label>
                        <label>
                          Email
                          <input
                            type="email"
                            name="email"
                            value={profileForm.email}
                            onChange={handleProfileChange}
                          />
                        </label>
                        <label>
                          Phone Number
                          <input
                            type="tel"
                            name="phone"
                            value={profileForm.phone}
                            onChange={handleProfileChange}
                          />
                        </label>
                        <div className="admin-profile-form-actions">
                          <button type="submit">Save Changes</button>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileForm(buildProfileForm(admin));
                              clearAlerts();
                              setIsEditingProfile(false);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </section>
                  )}
                </div>
              </section>
            )}

            {activeView === "wallet" && (
              <>
                <section className="wallet-management-stats" aria-label="Wallet request statistics">
                  {[
                    ["Pending Requests", pendingWalletRequests, "orange"],
                    ["Approved Today", 12, "green"],
                    ["Total Added Today", "₹1,850", ""],
                    ["Avg. Request", "₹75.00", ""],
                  ].map(([label, value, tone]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <strong className={tone}>{value}</strong>
                    </article>
                  ))}
                </section>

                <section className="wallet-management-section">
                  <h2>Add Money Requests</h2>
                  <div className="admin-table-wrap wallet-management-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Request ID</th>
                          <th>Student</th>
                          <th>Amount</th>
                          <th>Request Date</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {walletRequests.map((request) => (
                          <tr key={request.id}>
                            <td>{request.id}</td>
                            <td>
                              <div className="wallet-student-cell">
                                <strong>{request.student}</strong>
                                <span>{request.studentId}</span>
                              </div>
                            </td>
                            <td className="wallet-request-amount">{`₹${Number(request.amount).toFixed(2)}`}</td>
                            <td>
                              <div className="wallet-date-cell">
                                <strong>{request.requestDate}</strong>
                                <span>{request.requestTime}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`wallet-request-status ${request.status}`}>
                                <AdminIcon
                                  type={
                                    request.status === "pending"
                                      ? "clock"
                                      : request.status === "approved"
                                        ? "check"
                                        : "x"
                                  }
                                />
                                {request.status}
                              </span>
                            </td>
                            <td>
                              {request.status === "pending" ? (
                                <div className="wallet-request-actions">
                                  <button
                                    className="approve"
                                    type="button"
                                    onClick={() => handleWalletRequestStatus(request.id, "approved")}
                                  >
                                    <AdminIcon type="check" />
                                    Approve
                                  </button>
                                  <button
                                    className="reject"
                                    type="button"
                                    onClick={() => handleWalletRequestStatus(request.id, "rejected")}
                                  >
                                    <AdminIcon type="x" />
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="wallet-no-action">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>

      {dashboardModal && (
        <DashboardDetailsModal
          type={dashboardModal}
          students={students}
          vendors={vendors}
          transactions={transactions}
          selectedItem={selectedDashboardItem}
          onSelect={setSelectedDashboardItem}
          onBack={() => setSelectedDashboardItem(null)}
          onClose={closeDashboardModal}
          getVendorSales={getVendorSales}
        />
      )}
    </div>
  );
}

function DashboardDetailsModal({
  type,
  students,
  vendors,
  transactions,
  selectedItem,
  onSelect,
  onBack,
  onClose,
  getVendorSales,
}) {
  const title = {
    students: "All Students",
    vendors: "All Vendors",
    transactions: "All Transactions",
    wallet: "Student Wallet Balances",
  }[type];

  const detailTitle = type === "vendors" ? "Vendor Details" : "Student Details";
  const isPeopleList = type === "students" || type === "vendors" || type === "wallet";
  const people = type === "vendors" ? vendors : students;

  return (
    <div className="dashboard-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dashboard-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dashboard-modal-header">
          <div>
            {selectedItem && (
              <button className="dashboard-modal-back" type="button" onClick={onBack}>
                ← Back
              </button>
            )}
            <h2 id="dashboard-modal-title">{selectedItem ? detailTitle : title}</h2>
            {!selectedItem && (
              <p>
                {type === "transactions"
                  ? `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`
                  : `${people.length} ${type === "vendors" ? "vendor" : "student"}${people.length === 1 ? "" : "s"}`}
              </p>
            )}
          </div>
          <button className="dashboard-modal-close" type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="dashboard-modal-body">
          {selectedItem ? (
            <PersonDetails
              person={selectedItem}
              isVendor={type === "vendors"}
              totalSales={type === "vendors" ? getVendorSales(selectedItem) : null}
            />
          ) : type === "transactions" ? (
            <TransactionDetailsList transactions={transactions} />
          ) : isPeopleList ? (
            people.length ? (
              <div className="dashboard-people-list">
                {people.map((person) => (
                  <button
                    type="button"
                    className="dashboard-person-row"
                    key={person._id || person.email}
                    onClick={() => onSelect(person)}
                  >
                    <span className="dashboard-person-avatar">
                      {String(person.name || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="dashboard-person-info">
                      <strong>{person.name || "Unnamed user"}</strong>
                      <small>{person.email || "No email available"}</small>
                    </span>
                    <span className="dashboard-person-amount">
                      {type === "vendors" ? "Total received" : "Wallet balance"}
                      <strong>
                        {formatMoney(type === "vendors" ? getVendorSales(person) : person.walletBalance)}
                      </strong>
                    </span>
                    <span className="dashboard-row-chevron">›</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="dashboard-modal-empty">No records found.</p>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PersonDetails({ person, isVendor, totalSales }) {
  const fields = [
    ["Name", person.name || "-"],
    ["Email", person.email || "-"],
    ["Phone", person.phone || "-"],
    ["Account type", isVendor ? "Vendor" : "Student"],
    ["Account status", isVendor ? pageTitle(person.vendorStatus || "pending") : pageTitle(person.accountStatus || "active")],
    [isVendor ? "Wallet balance" : "Wallet balance", formatMoney(person.walletBalance)],
    ...(isVendor ? [["Total amount received", formatMoney(totalSales)]] : []),
    ["Joined", person.createdAt ? new Date(person.createdAt).toLocaleString() : "-"],
  ];

  return (
    <div className="dashboard-person-details">
      <div className="dashboard-detail-identity">
        <span>{String(person.name || "?").charAt(0).toUpperCase()}</span>
        <div>
          <h3>{person.name || "Unnamed user"}</h3>
          <p>{person.email || "No email available"}</p>
        </div>
      </div>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={label === "Account status" && value === "Active" ? "active-status" : ""}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TransactionDetailsList({ transactions }) {
  if (!transactions.length) {
    return <p className="dashboard-modal-empty">No transactions found.</p>;
  }

  return (
    <div className="dashboard-transaction-list">
      {transactions.map((transaction, index) => {
        const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : null;
        return (
          <article key={transaction._id || index} className="dashboard-transaction-row">
            <div>
              <strong>{transaction.student?.name || "Wallet top-up"}</strong>
              <span>→</span>
              <strong>{transaction.vendor?.name || "Student wallet"}</strong>
              <p>{transaction.description || pageTitle(String(transaction.type || "transaction").replaceAll("_", " "))}</p>
            </div>
            <div className="dashboard-transaction-meta">
              <strong>{formatMoney(transaction.amount)}</strong>
              <span className={`transaction-status ${String(transaction.status || "completed").toLowerCase()}`}>
                {transaction.status || "completed"}
              </span>
              <time dateTime={transaction.createdAt}>
                {createdAt
                  ? createdAt.toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "-"}
              </time>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function pageTitle(view) {
  return view.charAt(0).toUpperCase() + view.slice(1);
}

function AdminTable({ columns, rows, emptyText }) {
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{emptyText}</td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={`${row[0]}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function AdminIcon({ type }) {
  const icons = {
    bell: (
      <>
        <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
        <path d="M10 21h4" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-5" />
        <path d="M12 16V8" />
        <path d="M16 16v-3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m15 18-6-6 6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
      </>
    ),
    qr: (
      <>
        <rect x="4" y="4" width="5" height="5" rx="1" />
        <rect x="15" y="4" width="5" height="5" rx="1" />
        <rect x="4" y="15" width="5" height="5" rx="1" />
        <path d="M15 15h2v2h-2z" />
        <path d="M20 15v5h-5" />
        <path d="M12 4v3" />
        <path d="M12 12h3" />
        <path d="M12 17v3" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2 3.4-.2-.1a1.8 1.8 0 0 0-2 .4l-.1.1h-4l-.1-.1a1.8 1.8 0 0 0-2-.4l-.2.1-2-3.4.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.6-1.2H6v-4h.2a1.8 1.8 0 0 0 1.6-1.2 1.8 1.8 0 0 0-.4-2l-.1-.1 2-3.4.2.1a1.8 1.8 0 0 0 2-.4l.1-.1h4l.1.1a1.8 1.8 0 0 0 2 .4l.2-.1 2 3.4-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.6 1.2h.2v4h-.2a1.8 1.8 0 0 0-1.6 1.2Z" />
      </>
    ),
    store: (
      <>
        <path d="M4 10h16l-2-5H6l-2 5Z" />
        <path d="M6 10v9h12v-9" />
        <path d="M9 19v-5h6v5" />
      </>
    ),
    students: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M15 14.5a5 5 0 0 1 6 4.5" />
      </>
    ),
    swap: (
      <>
        <path d="M7 7h12" />
        <path d="m15 3 4 4-4 4" />
        <path d="M17 17H5" />
        <path d="m9 21-4-4 4-4" />
      </>
    ),
    trend: (
      <>
        <path d="m4 16 6-6 4 4 6-8" />
        <path d="M14 6h6v6" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 7a2 2 0 0 1 2-2h13v14H6a2 2 0 0 1-2-2V7Z" />
        <path d="M4 9h16" />
        <path d="M16 13h4v4h-4a2 2 0 0 1 0-4Z" />
      </>
    ),
    x: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icons[type] || icons.grid}
    </svg>
  );
}

export default AdminDashboardPage;
