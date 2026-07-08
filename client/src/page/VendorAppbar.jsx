import { useCallback, useEffect, useRef, useState } from "react";
import { getNotifications } from "../api/auth";
import { Icon } from "./VendorIcon";

const getStoredUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("cpacUser") || "{}");
    return user._id || user.id || user.email || "vendor";
  } catch {
    return "vendor";
  }
};

const getDismissedStorageKey = () => `cpacVendorDismissedNotificationIds:${getStoredUserId()}`;

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

function VendorAppbar({ title, vendor = {}, onLogout }) {
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
      console.error("Failed to load vendor notifications:", notificationError);
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

  const displayName = vendor.name || "Campus Cafe";
  const displayEmail = vendor.email || "vendor@campus.edu";
  const displayPhoto = vendor.profilePicture || "";
  const displayInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="vendor-appbar">
      <div>
        <h2>{title}</h2>
        <p>Thursday, June 18, 2026</p>
      </div>
      <div className="vendor-appbar-actions">
        {/* Notification Bell Wrapper */}
        <div className="notification-wrapper" ref={notifRef}>
          <button
            className={`vendor-notification${isNotifOpen ? " active" : ""}`}
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
            <div className="vendor-user-summary">
              <strong>{displayName}</strong>
              <span>{displayEmail}</span>
            </div>
            <span className="vendor-avatar">
              {displayPhoto ? (
                <img src={displayPhoto} alt={`${displayName} profile`} />
              ) : (
                <Icon type="user" />
              )}
            </span>
          </div>

          {isProfileOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-info">
                <span className="profile-dropdown-avatar">
                  {displayPhoto ? (
                    <img src={displayPhoto} alt={`${displayName} profile`} />
                  ) : (
                    displayInitial
                  )}
                </span>
                <strong>{displayName}</strong>
                <span className="email">{displayEmail}</span>
                <span className="badge" style={{ textTransform: "capitalize" }}>
                  Vendor Account
                </span>
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

export default VendorAppbar;
