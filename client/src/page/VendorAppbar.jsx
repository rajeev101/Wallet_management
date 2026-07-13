import { useEffect, useRef, useState } from "react";
import { Icon } from "./VendorIcon";
import { clearNotifications, getNotifications } from "../api/auth";

function VendorAppbar({ title, vendor = {}, onLogout }) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

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

  useEffect(() => {
    const token = localStorage.getItem("cpacToken");
    if (!token) return undefined;

    const loadNotifications = async () => {
      try {
        const data = await getNotifications(token);
        setNotifications(data.notifications || []);
      } catch (error) {
        console.error("Failed to load notifications:", error);
      }
    };

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const handleClearNotif = async () => {
    const token = localStorage.getItem("cpacToken");
    if (!token) return;

    try {
      await clearNotifications(token);
      setNotifications([]);
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
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

  const getVendorInfo = () => {
    if (vendor && (vendor.name || vendor.email)) {
      return vendor;
    }

    try {
      const storedUser = JSON.parse(localStorage.getItem("cpacUser") || "{}");
      return {
        name: storedUser.name || "Campus Cafe",
        email: storedUser.email || "vendor@campus.edu",
        profilePicture: storedUser.profilePicture || "",
      };
    } catch {
      return {
        name: "Campus Cafe",
        email: "vendor@campus.edu",
        profilePicture: "",
      };
    }
  };

  const vendorInfo = getVendorInfo();
  const displayName = vendorInfo.name || "Campus Cafe";
  const displayEmail = vendorInfo.email || "vendor@campus.edu";

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
              {vendorInfo.profilePicture ? (
                <img src={vendorInfo.profilePicture} alt={`${displayName} avatar`} />
              ) : (
                <Icon type="user" />
              )}
            </span>
          </div>

          {isProfileOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-info">
                <span className="profile-dropdown-avatar">
                  {vendorInfo.profilePicture ? (
                    <img src={vendorInfo.profilePicture} alt={`${displayName} avatar`} />
                  ) : (
                    displayName.charAt(0).toUpperCase()
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
