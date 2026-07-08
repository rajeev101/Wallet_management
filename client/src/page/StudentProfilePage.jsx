import { useEffect, useRef, useState } from "react";
import { getProfile, updateProfile } from "../api/auth";
import { Icon } from "./StudentIcon";

const getStoredStudent = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("cpacUser") || "{}");

    return {
      id: storedUser._id || storedUser.id || "",
      name: storedUser.name || "",
      email: storedUser.email || "",
      phone: storedUser.phone || "",
      accountType: storedUser.accountType || "student",
      walletBalance: storedUser.walletBalance || 0,
      profilePicture: storedUser.profilePicture || "",
      accountStatus: storedUser.accountStatus || "Active",
      createdAt: storedUser.createdAt || "",
    };
  } catch {
    return {
      id: "",
      name: "",
      email: "",
      phone: "",
      accountType: "student",
      walletBalance: 0,
      profilePicture: "",
      accountStatus: "Active",
      createdAt: "",
    };
  }
};

const formatJoinDate = (user = {}) => {
  if (user.joinDate) return user.joinDate;
  if (!user.createdAt) return "Not available";

  return new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const buildStudentProfile = (user = {}) => ({
  id: user._id || user.id || "",
  name: user.name || "",
  email: user.email || "",
  phone: user.phone || "",
  profilePicture: user.profilePicture || "",
  accountStatus: user.accountStatus || "Active",
  joinDate: formatJoinDate(user),
  walletBalance: user.walletBalance !== undefined ? user.walletBalance : 0,
  accountType: user.accountType || "student",
});

const createStudentId = (id) => {
  if (!id) {
    return "STU12345";
  }

  return `STU${id.slice(-5).toUpperCase()}`;
};

function StudentProfilePage({ initialStudent, onProfileChange }) {
  const [student, setStudent] = useState(() => buildStudentProfile(initialStudent || getStoredStudent()));
  const [profile, setProfile] = useState(() => buildStudentProfile(initialStudent || getStoredStudent()));
  const [form, setForm] = useState(() => buildStudentProfile(initialStudent || getStoredStudent()));
  const [status, setStatus] = useState({ message: "", type: "success" });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPhotoActionsOpen, setIsPhotoActionsOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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

        const nextStudent = buildStudentProfile(safeUser);

        localStorage.setItem("cpacUser", JSON.stringify(safeUser));
        setStudent(nextStudent);
        setProfile(nextStudent);
        setForm(nextStudent);
        onProfileChange?.(nextStudent);
      })
      .catch(() => {
        setStatus({
          message: "Could not load latest profile details.",
          type: "error",
        });
      });
  }, [onProfileChange]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (photoMenuRef.current && !photoMenuRef.current.contains(event.target)) {
        setIsPhotoActionsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsPhotoActionsOpen(false);
        setIsPreviewOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const studentId = createStudentId(student.id);
  const displayName = profile.name.trim() || "Student";

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
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm((currentForm) => ({
        ...currentForm,
        profilePicture: reader.result,
      }));
      setIsPhotoActionsOpen(false);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleRemoveProfilePhoto = () => {
    setForm((currentForm) => ({
      ...currentForm,
      profilePicture: "",
    }));
    setIsPhotoActionsOpen(false);
    setIsPreviewOpen(false);
  };

  const handleCancel = () => {
    setForm(profile);
    setStatus({ message: "", type: "success" });
    setIsPhotoActionsOpen(false);
    setIsPreviewOpen(false);
    setIsEditing(false);
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
          profilePicture: form.profilePicture,
        },
        token
      );
      const safeUser = { ...(data.user || {}) };
      delete safeUser.password;
      const nextStudent = buildStudentProfile(safeUser);

      localStorage.setItem("cpacUser", JSON.stringify(safeUser));
      localStorage.setItem("cpacUserType", safeUser.accountType || "student");
      setStudent(nextStudent);
      setProfile(nextStudent);
      setForm(nextStudent);
      onProfileChange?.(nextStudent);
      setStatus({ message: "Profile updated successfully.", type: "success" });
      setIsEditing(false);
    } catch (error) {
      setStatus({ message: error.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="vendor-profile-page" aria-label="Student profile">
      {!isEditing && (
        <article className="vendor-card vendor-profile-card">
          <div className="vendor-profile-hero">
            <span className="vendor-profile-large-photo">
              {profile.profilePicture ? (
                <img src={profile.profilePicture} alt={`${profile.name || "Student"} profile`} />
              ) : (
                <Icon type="user" />
              )}
            </span>
            <h2>{displayName}</h2>
            <span>Student Account</span>
          </div>

          <div className="vendor-profile-detail-grid">
            {[
              ["Student ID", createStudentId(student.id)],
              ["Role", "Student"],
              ["Email", profile.email || "Not available"],
              ["Phone Number", profile.phone || "Not available"],
              ["Wallet Balance", `$${Number(profile.walletBalance || 0).toFixed(2)}`],
              ["Account Status", profile.accountStatus || "Active"],
              ["Join Date", profile.joinDate],
            ].map(([label, value]) => (
              <div className="vendor-profile-detail-tile" key={label}>
                <strong>{label}</strong>
                <span className={label === "Account Status" ? "status-value" : ""}>{value}</span>
              </div>
            ))}
          </div>

          <button className="vendor-profile-edit-button" type="button" onClick={() => setIsEditing(true)}>
            Edit Profile
          </button>
        </article>
      )}

      {isEditing && (
        <form className="vendor-card vendor-profile-edit-card" onSubmit={handleSubmit}>
          <div className="vendor-profile-heading">
            <h2>Edit Profile</h2>
            <span>Update your student account details</span>
          </div>

          <div className="vendor-profile-photo-editor" ref={photoMenuRef}>
            <button
              className="vendor-profile-photo-preview"
              type="button"
              onClick={() => form.profilePicture && setIsPreviewOpen(true)}
              aria-label="Show profile photo"
            >
              {form.profilePicture ? (
                <img src={form.profilePicture} alt="Profile" />
              ) : (
                <Icon type="user" />
              )}
            </button>
            <button
              className="vendor-profile-photo-edit"
              type="button"
              aria-label="Edit profile photo"
              onClick={() => setIsPhotoActionsOpen((isOpen) => !isOpen)}
            >
              <Icon type="edit" />
            </button>
            {isPhotoActionsOpen && (
              <div className="vendor-profile-photo-menu">
                <button type="button" onClick={() => photoInputRef.current?.click()}>
                  Change Photo
                </button>
                <button type="button" onClick={handleRemoveProfilePhoto}>
                  Remove Photo
                </button>
              </div>
            )}
            <input
              ref={photoInputRef}
              className="vendor-profile-file-input"
              type="file"
              accept="image/*"
              onChange={handleProfileImage}
            />
          </div>

          <label htmlFor="studentFullName">
            Full Name
            <input
              id="studentFullName"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter full name"
              required
            />
          </label>

          <label htmlFor="studentEmail">
            Email Address
            <input
              id="studentEmail"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter email address"
              required
            />
          </label>

          <label htmlFor="studentPhone">
            Phone Number
            <input
              id="studentPhone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
            />
          </label>

          <div className="vendor-profile-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {status.message && (
        <p className={`profile-save-status ${status.type}`}>{status.message}</p>
      )}

      {isPreviewOpen && form.profilePicture && (
        <div className="vendor-profile-preview-modal" role="dialog" aria-modal="true">
          <button
            className="vendor-profile-preview-close"
            type="button"
            aria-label="Close profile photo preview"
            onClick={() => setIsPreviewOpen(false)}
          >
            <Icon type="x" />
          </button>
          <img src={form.profilePicture} alt="Profile preview" />
        </div>
      )}
    </section>
  );
}

export default StudentProfilePage;
