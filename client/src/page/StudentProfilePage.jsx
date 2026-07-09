import { useEffect, useState } from "react";
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
    };
  } catch {
    return {
      id: "",
      name: "",
      email: "",
      phone: "",
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

function StudentProfilePage({ initialStudent, onProfileChange }) {
  const [student, setStudent] = useState(initialStudent || getStoredStudent);
  const [profile, setProfile] = useState({
    name: student.name,
    email: student.email,
    phone: student.phone,
  });
  const [status, setStatus] = useState({ message: "", type: "success" });
  const [isSaving, setIsSaving] = useState(false);

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
        });
      })
      .catch(() => {
        setStatus({
          message: "Could not load latest profile details.",
          type: "error",
        });
      });
  }, []);

  const studentId = createStudentId(student.id);
  const displayName = profile.name.trim() || "Student";

  const handleChange = (event) => {
    const { name, value } = event.target;

    setProfile((currentProfile) => ({
      ...currentProfile,
      [name]: value,
    }));
    setStatus({ message: "", type: "success" });
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
      });
      setStatus({ message: "Profile changes saved.", type: "success" });
    } catch (error) {
      setStatus({ message: error.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="student-profile-view" aria-label="Student profile">
      <aside className="profile-overview-card">
        <span className="profile-large-avatar">
          <Icon type="user" />
        </span>
        <h2>{displayName}</h2>
        <p>Student ID: {studentId}</p>
        <div className="profile-wallet-summary">
          <span>Wallet Balance</span>
          <strong>₹{Number(student.walletBalance || 0).toFixed(2)}</strong>
        </div>
      </aside>

      <div className="profile-settings-column">
        <form className="profile-settings-card" onSubmit={handleSubmit}>
          <h2>Personal Information</h2>
          <label htmlFor="studentFullName">Full Name</label>
          <div className="profile-input">
            <Icon type="user" />
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
            <Icon type="mail" />
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
            <Icon type="phone" />
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

          <button className="profile-primary-button" type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          {status.message && (
            <p className={`profile-save-status ${status.type}`}>{status.message}</p>
          )}
        </form>
      </div>
    </section>
  );
}

export default StudentProfilePage;
