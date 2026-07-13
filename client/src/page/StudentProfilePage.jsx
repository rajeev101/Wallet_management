import { useEffect, useRef, useState } from "react";
import StudentHeader from "./StudentHeader";
import { getProfile, updateProfile } from "../api/auth";

const getStoredStudent = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("cpacUser") || "{}");

    return {
      id: storedUser._id || storedUser.id || "",
      name: storedUser.name || "",
      email: storedUser.email || "",
      phone: storedUser.phone || "",
      profilePicture: storedUser.profilePicture || "",
      accountType: storedUser.accountType || "student",
      walletBalance: storedUser.walletBalance || 0,
    };
  } catch {
    return {
      id: "",
      name: "",
      email: "",
      phone: "",
      profilePicture: "",
      accountType: "student",
      walletBalance: 0,
    };
  }
};

const createStudentId = (id) => {
  if (!id) {
    return "STU12345";
  }

  return `STU${id.slice(-5).toUpperCase()}`;
};

const getNameInitials = (name = "Student") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "ST";
  }

  const firstInitial = parts[0].charAt(0);
  const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0) : parts[0].charAt(1);

  return `${firstInitial}${lastInitial || ""}`.toUpperCase();
};

const formatAccountType = (accountType = "student") =>
  accountType.charAt(0).toUpperCase() + accountType.slice(1);

function StudentProfilePage({ initialStudent, onProfileChange, onLogout }) {
  const [student, setStudent] = useState(initialStudent || getStoredStudent);
  const [profile, setProfile] = useState({
    name: student.name,
    email: student.email,
    phone: student.phone,
    photo: student.profilePicture,
  });
  const [status, setStatus] = useState({ message: "", type: "success" });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const photoMenuRef = useRef(null);
  const photoInputRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("cpacToken");

    if (!token) {
      return;
    }

    getProfile(token)
      .then((data) => {
        const safeUser = { ...(data.user || {}) };
        delete safeUser.password;

        const nextStudent = {
          id: safeUser._id || safeUser.id || "",
          name: safeUser.name || "",
          email: safeUser.email || "",
          phone: safeUser.phone || "",
          profilePicture: safeUser.profilePicture || "",
          accountType: safeUser.accountType || "student",
          walletBalance: safeUser.walletBalance || 0,
        };

        localStorage.setItem("cpacUser", JSON.stringify(safeUser));
        setStudent(nextStudent);
        onProfileChange?.(nextStudent);
        setProfile({
          name: nextStudent.name,
          email: nextStudent.email,
          phone: nextStudent.phone,
          photo: nextStudent.profilePicture,
        });
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

  const studentId = createStudentId(student.id);
  const displayName = profile.name.trim() || "Student";
  const studentInitials = getNameInitials(displayName);
  const profilePhoto = profile.photo || "";

  const handleChange = (event) => {
    const { name, value } = event.target;

    setProfile((currentProfile) => ({
      ...currentProfile,
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
      setProfile((currentProfile) => ({
        ...currentProfile,
        photo: reader.result,
      }));
      setStatus({ message: "", type: "success" });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
    setIsPhotoMenuOpen(false);
  };

  const handleRemoveProfileImage = () => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      photo: "",
    }));
    setStatus({ message: "", type: "success" });
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
          name: profile.name.trim(),
          email: profile.email.trim(),
          phone: profile.phone.trim(),
          profilePicture: profile.photo,
        },
        token
      );
      const safeUser = { ...(data.user || {}) };
      delete safeUser.password;
      const nextStudent = {
        id: safeUser._id || safeUser.id || student.id,
        name: safeUser.name || "",
        email: safeUser.email || "",
        phone: safeUser.phone || "",
        profilePicture: safeUser.profilePicture || "",
        accountType: safeUser.accountType || "student",
        walletBalance: safeUser.walletBalance !== undefined ? safeUser.walletBalance : student.walletBalance,
      };

      localStorage.setItem("cpacUser", JSON.stringify(safeUser));
      localStorage.setItem("cpacUserType", safeUser.accountType || "student");
      setStudent(nextStudent);
      onProfileChange?.(nextStudent);
      setProfile({
        name: nextStudent.name,
        email: nextStudent.email,
        phone: nextStudent.phone,
        photo: nextStudent.profilePicture,
      });
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
    <>
      <StudentHeader
        title="Profile"
        dateText="Manage your personal information"
        student={{ ...student, profilePicture: profile.photo }}
        onLogout={onLogout}
      />
      <section className="student-profile-view" aria-label="Student profile">
        {!isEditingProfile ? (
        <article className="profile-settings-card">
          <div className="profile-overview-card">
            <span className="profile-large-avatar">
              {profilePhoto ? <img src={profilePhoto} alt={`${displayName} profile`} /> : studentInitials}
            </span>
            <div>
              <h2>{displayName}</h2>
              <span>Student</span>
            </div>
          </div>

          <div className="profile-details-grid">
            <div>
              <strong>Full Name</strong>
              <span>{displayName}</span>
            </div>
            <div>
              <strong>Student ID</strong>
              <span>{studentId}</span>
            </div>
            <div>
              <strong>Account Type</strong>
              <span>{formatAccountType(student.accountType)}</span>
            </div>
            <div>
              <strong>Email</strong>
              <span>{profile.email || "Not available"}</span>
            </div>
            <div>
              <strong>Phone Number</strong>
              <span>{profile.phone || "Not available"}</span>
            </div>
            <div>
              <strong>Wallet Balance</strong>
              <span className="profile-wallet-value">₹{Number(student.walletBalance || 0).toFixed(2)}</span>
            </div>
          </div>

          <button
            className="profile-primary-button profile-edit-button"
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
        <article className="profile-settings-card profile-edit-card">
          <div className="profile-form-heading">
            <h2>Edit Profile</h2>
            <span>Update your student account details</span>
          </div>
          <form className="profile-edit-form" onSubmit={handleSubmit}>
            <div className="profile-edit-photo" aria-label="Profile photo">
              <div className="profile-photo-upload" ref={photoMenuRef}>
                <label>
                  <span className="profile-large-avatar">
                    {profilePhoto ? <img src={profilePhoto} alt={`${displayName} profile`} /> : studentInitials}
                  </span>
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handleProfileImage} />
                </label>
                <button
                  className="profile-photo-edit-badge"
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
                  <div className="profile-photo-dropdown" role="menu" aria-label="Profile photo options">
                    <button
                      className="profile-photo-dropdown-item"
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
                        className="profile-photo-dropdown-item danger"
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

            <label htmlFor="studentFullName">Full Name</label>
            <div className="profile-input">
              <input
                id="studentFullName"
                name="name"
                type="text"
                value={profile.name}
                onChange={handleChange}
                placeholder="Enter full name"
                autoComplete="name"
              />
            </div>

            <label htmlFor="studentEmail">Email Address</label>
            <div className="profile-input">
              <input
                id="studentEmail"
                name="email"
                type="email"
                value={profile.email}
                onChange={handleChange}
                placeholder="Enter email address"
                autoComplete="email"
              />
            </div>

            <label htmlFor="studentPhone">Phone Number</label>
            <div className="profile-input">
              <input
                id="studentPhone"
                name="phone"
                type="tel"
                value={profile.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
                autoComplete="tel"
              />
            </div>

            <div className="profile-form-actions">
              <button className="profile-primary-button" type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                className="profile-secondary-button"
                type="button"
                onClick={() => {
                  setProfile({
                    name: student.name,
                    email: student.email,
                    phone: student.phone,
                    photo: student.profilePicture,
                  });
                  setStatus({ message: "", type: "success" });
                  setIsEditingProfile(false);
                }}
              >
                Cancel
              </button>
            </div>
            {status.message && (
              <p className={`profile-save-status ${status.type}`}>{status.message}</p>
            )}
          </form>
        </article>
        )}
      </section>
    </>
  );
}

export default StudentProfilePage;
