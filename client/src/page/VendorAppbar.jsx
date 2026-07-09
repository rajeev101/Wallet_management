import { useEffect, useRef, useState } from "react";
import { Icon } from "./VendorIcon";

const defaultNotifications = [
  { id: 1, text: "Payment Received: ₹12.50 from John Doe.", time: "June 18, 2026 at 2:30 PM" },
  { id: 2, text: "Payment Received: ₹15.75 from Sarah Williams.", time: "June 18, 2026 at 1:00 PM" },
  { id: 3, text: "Welcome to Campus Wallet! Start accepting payments.", time: "June 15, 2026 at 9:00 AM" },
];

function VendorAppbar({ title, vendor = {}, onLogout }) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState(defaultNotifications);

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

  const handleClearNotif = () => {
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
