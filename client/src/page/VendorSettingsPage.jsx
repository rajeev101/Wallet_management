import { useEffect, useRef, useState } from "react";
import { getProfile, updateProfile } from "../api/auth";

const getStoredVendor = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("cpacUser") || "{}");
    return {
      id: storedUser._id || storedUser.id || "",
      name: storedUser.name || "",
      email: storedUser.email || "",
      phone: storedUser.phone || "",
      profilePicture: storedUser.profilePicture || "",
      accountType: storedUser.accountType || "vendor",
      walletBalance: storedUser.walletBalance || 0,
    };
  } catch {
    return {
      id: "",
      name: "",
      email: "",
      phone: "",
      profilePicture: "",
      accountType: "vendor",
      walletBalance: 0,
    };
  }
};

const createVendorId = (id) => {
  if (!id) {
    return "VEN12345";
  }

  return `VEN${id.slice(-5).toUpperCase()}`;
};

const getNameInitials = (name = "Vendor") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "VN";
  }

  const firstInitial = parts[0].charAt(0);
  const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0) : parts[0].charAt(1);

  return `${firstInitial}${lastInitial || ""}`.toUpperCase();
};

const formatAccountType = (accountType = "vendor") =>
  accountType.charAt(0).toUpperCase() + accountType.slice(1);

function VendorSettingsPage({ vendor, onProfileChange }) {
  const [profile, setProfile] = useState(vendor || getStoredVendor);
  const [form, setForm] = useState({
    name: profile.name,
    email: profile.email,
    phone: profile.phone || "",
    photo: profile.profilePicture || "",
  });
  const [status, setStatus] = useState({ message: "", type: "success" });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const photoMenuRef = useRef(null);
  const photoInputRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("cpacToken");
    if (!token) return;

    getProfile(token)
      .then((data) => {
        const safeUser = { ...(data.user || {}) };
        delete safeUser.password;

        const nextVendor = {
          id: safeUser._id || safeUser.id || "",
          name: safeUser.name || "",
          email: safeUser.email || "",
          phone: safeUser.phone || "",
          profilePicture: safeUser.profilePicture || "",
          accountType: safeUser.accountType || "vendor",
          walletBalance: safeUser.walletBalance || 0,
        };

        localStorage.setItem("cpacUser", JSON.stringify(safeUser));
        setProfile(nextVendor);
        setForm({
          name: nextVendor.name,
          email: nextVendor.email,
          phone: nextVendor.phone,
          photo: nextVendor.profilePicture,
        });
        onProfileChange?.(nextVendor);
      })
      .catch(() => {
        setStatus({
          message: "Could not load latest profile details.",
          type: "error",
        });
      });
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (photoMenuRef.current && !photoMenuRef.current.contains(event.target)) {
        setIsPhotoMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const vendorId = createVendorId(profile.id);
  const displayName = form.name.trim() || "Vendor";
  const vendorInitials = getNameInitials(displayName);
  const profilePhoto = form.photo || "";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
    setStatus({ message: "", type: "success" });
  };

  const handleProfileImage = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const nextPhoto = reader.result;
      setForm((currentForm) => ({
        ...currentForm,
        photo: nextPhoto,
      }));
      setStatus({ message: "", type: "success" });
      onProfileChange?.({
        ...profile,
        name: form.name.trim() || profile.name,
        email: form.email.trim() || profile.email,
        phone: form.phone,
        profilePicture: nextPhoto,
      });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
    setIsPhotoMenuOpen(false);
  };

  const handleRemoveProfileImage = () => {
    setForm((currentForm) => ({
      ...currentForm,
      photo: "",
    }));
    setStatus({ message: "", type: "success" });
    onProfileChange?.({
      ...profile,
      name: form.name.trim() || profile.name,
      email: form.email.trim() || profile.email,
      phone: form.phone,
      profilePicture: "",
    });
    setIsPhotoMenuOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ message: "", type: "success" });

    const token = localStorage.getItem("cpacToken");
    if (!token) {
      setStatus({
        message: "Please login again to save profile changes.",
        type: "error",
      });
      return;
    }

    setIsSaving(true);

    try {
      const data = await updateProfile(
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          profilePicture: form.photo,
        },
        token
      );
      const safeUser = { ...(data.user || {}) };
      delete safeUser.password;

      const nextVendor = {
        id: safeUser._id || safeUser.id || profile.id,
        name: safeUser.name || "",
        email: safeUser.email || "",
        phone: safeUser.phone || "",
        profilePicture: safeUser.profilePicture || "",
        accountType: safeUser.accountType || "vendor",
        walletBalance: safeUser.walletBalance !== undefined ? safeUser.walletBalance : profile.walletBalance,
      };

      localStorage.setItem("cpacUser", JSON.stringify(safeUser));
      setProfile(nextVendor);
      setForm({
        name: nextVendor.name,
        email: nextVendor.email,
        phone: nextVendor.phone,
        photo: nextVendor.profilePicture,
      });
      onProfileChange?.(nextVendor);
      setStatus({ message: "Profile changes saved.", type: "success" });
      setIsEditingProfile(false);
      setIsPhotoMenuOpen(false);
    } catch (error) {
      setStatus({ message: error.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="vendor-profile-view" aria-label="Vendor profile">
      {!isEditingProfile ? (
        <article className="vendor-profile-card">
          <div className="vendor-profile-overview">
            <span className="vendor-profile-large-avatar">
              {profilePhoto ? <img src={profilePhoto} alt={`${displayName} profile`} /> : vendorInitials}
            </span>
            <div>
              <h2>{displayName}</h2>
              <span>Vendor</span>
            </div>
          </div>

          <div className="vendor-profile-details-grid">
            <div>
              <strong>Full Name</strong>
              <span>{displayName}</span>
            </div>
            <div>
              <strong>Vendor ID</strong>
              <span>{vendorId}</span>
            </div>
            <div>
              <strong>Account Type</strong>
              <span>{formatAccountType(profile.accountType)}</span>
            </div>
            <div>
              <strong>Email</strong>
              <span>{form.email || "Not available"}</span>
            </div>
            <div>
              <strong>Phone Number</strong>
              <span>{form.phone || "Not available"}</span>
            </div>
            <div>
              <strong>Wallet Balance</strong>
              <span className="vendor-profile-wallet-value">₹{Number(profile.walletBalance || 0).toFixed(2)}</span>
            </div>
          </div>

          <button
            className="vendor-profile-primary-button"
            type="button"
            onClick={() => {
              setStatus({ message: "", type: "success" });
              setIsEditingProfile(true);
            }}
          >
            Edit Profile
          </button>
        </article>
      ) : (
        <article className="vendor-profile-card vendor-profile-edit-card">
          <div className="vendor-profile-form-heading">
            <h2>Edit Profile</h2>
            <span>Update your vendor account details</span>
          </div>

          <form className="vendor-profile-edit-form" onSubmit={handleSubmit}>
            <div className="vendor-profile-edit-photo" aria-label="Profile photo">
              <div className="vendor-profile-photo-upload" ref={photoMenuRef}>
                <label>
                  <span className="vendor-profile-large-avatar">
                    {profilePhoto ? <img src={profilePhoto} alt={`${displayName} profile`} /> : vendorInitials}
                  </span>
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handleProfileImage} />
                </label>
                <button
                  className="vendor-profile-photo-edit-badge"
                  type="button"
                  aria-label="Edit profile photo"
                  onClick={() => setIsPhotoMenuOpen((isOpen) => !isOpen)}
                >
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
                </button>

                {isPhotoMenuOpen && (
                  <div className="vendor-profile-photo-dropdown" role="menu" aria-label="Profile photo options">
                    <button
                      className="vendor-profile-photo-dropdown-item"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        photoInputRef.current?.click();
                        setIsPhotoMenuOpen(false);
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7h4l2-3h4l2 3h4v11H4V7Z" />
                        <circle cx="12" cy="12" r="3.5" />
                      </svg>
                      Change Photo
                    </button>
                    {profilePhoto && (
                      <button
                        className="vendor-profile-photo-dropdown-item danger"
                        type="button"
                        role="menuitem"
                        onClick={handleRemoveProfileImage}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 7h16" />
                          <path d="M9 7V5h6v2" />
                          <path d="M7 7l1 13h8l1-13" />
                        </svg>
                        Remove Photo
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <label htmlFor="vendorStoreName">Full Name</label>
            <div className="vendor-profile-input">
              <input
                id="vendorStoreName"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter full name"
                required
              />
            </div>

            <label htmlFor="vendorEmail">Email Address</label>
            <div className="vendor-profile-input">
              <input
                id="vendorEmail"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Enter email address"
                required
              />
            </div>

            <label htmlFor="vendorPhone">Phone Number</label>
            <div className="vendor-profile-input">
              <input
                id="vendorPhone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
                autoComplete="tel"
              />
            </div>

            <div className="vendor-profile-form-actions">
              <button className="vendor-profile-primary-button" type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                className="vendor-profile-secondary-button"
                type="button"
                onClick={() => {
                  setForm({
                    name: profile.name,
                    email: profile.email,
                    phone: profile.phone || "",
                    photo: profile.profilePicture || "",
                  });
                  onProfileChange?.(profile);
                  setStatus({ message: "", type: "success" });
                  setIsEditingProfile(false);
                }}
              >
                Cancel
              </button>
            </div>

            {status.message && (
              <p className={`vendor-profile-save-status ${status.type}`}>{status.message}</p>
            )}
          </form>
        </article>
      )}
    </section>
  );
}

export default VendorSettingsPage;
