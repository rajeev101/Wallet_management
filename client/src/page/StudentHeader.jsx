import { useCallback, useState, useEffect, useRef } from "react";
import { getNotifications } from "../api/auth";
import { Icon } from "./StudentIcon";

const getStoredUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("cpacUser") || "{}");
    return user._id || user.id || user.email || "student";
  } catch {
    return "student";
  }
};

const getDismissedStorageKey = () => `cpacStudentDismissedNotificationIds:${getStoredUserId()}`;

const getDismissedNotificationIds = (storageKey) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey) || "[]").map(String));
  } catch {
    return new Set();
  }
};

const saveDismissedNotificationIds = (storageKey, ids) => {
  localStorage.setItem(storageKey, JSON.stringify([...ids]));
};

function StudentHeader({ title, dateText = "Wednesday, June 17, 2026", student, onLogout, showSearch = false }) {
  const dismissedStorageKey = getDismissedStorageKey();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const dismissedStorageKeyRef = useRef(dismissedStorageKey);
  const dismissedNotificationIdsRef = useRef(getDismissedNotificationIds(dismissedStorageKey));

  const loadNotifications = useCallback(async () => {
    const token = localStorage.getItem("cpacToken");
    if (!token) return;

    try {
      const data = await getNotifications(token);
      setNotifications(
        (data.notifications || []).filter((notif) => !dismissedNotificationIdsRef.current.has(String(notif.id)))
      );
    } catch (notificationError) {
      console.error("Failed to load notifications:", notificationError);
    }
  }, [setNotifications]);

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 15000);

    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  // Close dropdowns on clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleClearNotif = () => {
    notifications.forEach((notif) => dismissedNotificationIdsRef.current.add(String(notif.id)));
    saveDismissedNotificationIds(dismissedStorageKeyRef.current, dismissedNotificationIdsRef.current);
    setNotifications([]);
  };

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem("cpacToken");
      localStorage.removeItem("cpacUserType");
      localStorage.removeItem("cpacUser");
      window.location.reload();
    }
  };

  // Safe evaluation of student details
  const getStudentInfo = () => {
    if (student && student.name) {
      return student;
    }
    try {
      const storedUser = JSON.parse(localStorage.getItem("cpacUser") || "{}");
      return {
        name: storedUser.name || "Student",
        email: storedUser.email || "student@lsp.com",
        accountType: storedUser.accountType || "student"
      };
    } catch {
      return {
        name: "Student",
        email: "student@lsp.com",
        accountType: "student"
      };
    }
  };

  const user = getStudentInfo();
  const displayName = user.name || "Student";

  return (
    <div className="history-appbar">
      <div>
        <h2>{title}</h2>
        <p>{dateText}</p>
      </div>
      <div className="history-profile">
        {showSearch && (
          <label className="compact-search">
            <Icon type="search" />
            <input type="search" placeholder="Search..." />
          </label>
        )}

        {/* Notification Bell Wrapper */}
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
            <Icon type="bell" />
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
                    <div key={notif.id} className="notification-item">
                      <p>{notif.text}</p>
                      <span className="notif-time">{notif.time}</span>
                    </div>
                  ))
                ) : (
                  <div className="notification-empty">No new notifications</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Wrapper */}
        <div className="profile-wrapper" ref={profileRef}>
          <div
            className="profile-trigger-area"
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotifOpen(false);
            }}
          >
            <div className="profile-summary">
              <strong>{displayName}</strong>
              <span style={{ textTransform: "capitalize" }}>{user.accountType || "Student"}</span>
            </div>
            <span className="profile-avatar">
              <Icon type="user" />
            </span>
          </div>

          {isProfileOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-info">
                <span className="profile-dropdown-avatar">
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <strong>{displayName}</strong>
                <span className="email">{user.email || "student@lsp.com"}</span>
                <span className="badge" style={{ textTransform: "capitalize" }}>
                  {user.accountType || "student"} Account
                </span>
              </div>
              <div className="profile-dropdown-balance">
                <span>Wallet Balance</span>
                <strong>${Number(user.walletBalance || 0).toFixed(2)}</strong>
              </div>
              <div className="profile-dropdown-actions">
                <button className="logout-btn" type="button" onClick={handleLogoutClick}>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentHeader;
