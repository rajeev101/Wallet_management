import { useEffect, useState } from "react";
import { getProfile, updateProfile } from "../api/auth";

const getStoredVendor = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("cpacUser") || "{}");
    return {
      name: storedUser.name || "",
      email: storedUser.email || "",
    };
  } catch {
    return {
      name: "",
      email: "",
    };
  }
};

function VendorSettingsPage({ vendor, onProfileChange }) {
  const [profile, setProfile] = useState(vendor || getStoredVendor);
  const [form, setForm] = useState({
    name: profile.name,
    email: profile.email,
  });
  const [status, setStatus] = useState({ message: "", type: "success" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("cpacToken");
    if (!token) return;

    getProfile(token)
      .then((data) => {
        const safeUser = { ...(data.user || {}) };
        delete safeUser.password;

        const nextVendor = {
          name: safeUser.name || "",
          email: safeUser.email || "",
        };

        localStorage.setItem("cpacUser", JSON.stringify(safeUser));
        setProfile(nextVendor);
        setForm({
          name: nextVendor.name,
          email: nextVendor.email,
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
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
          name: form.name.trim(),
          email: form.email.trim(),
        },
        token
      );
      const safeUser = { ...(data.user || {}) };
      delete safeUser.password;

      const nextVendor = {
        name: safeUser.name || "",
        email: safeUser.email || "",
      };

      localStorage.setItem("cpacUser", JSON.stringify(safeUser));
      setProfile(nextVendor);
      onProfileChange?.(nextVendor);
      setStatus({ message: "Store settings saved successfully.", type: "success" });
    } catch (error) {
      setStatus({ message: error.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="vendor-card vendor-settings-card" onSubmit={handleSubmit}>
      <h2>Store Settings</h2>

      <label htmlFor="vendorStoreName">Store Name</label>
      <input
        id="vendorStoreName"
        name="name"
        type="text"
        value={form.name}
        onChange={handleChange}
        placeholder="Enter store name"
        required
      />

      <label htmlFor="vendorEmail">Email Address</label>
      <input
        id="vendorEmail"
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        placeholder="Enter email address"
        required
      />

      <button type="submit" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Settings"}
      </button>

      {status.message && (
        <p className={`profile-save-status ${status.type}`} style={{
          marginTop: "12px",
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "0.85rem",
          fontWeight: "500",
          textAlign: "center",
          color: status.type === "success" ? "#0f5132" : "#842029",
          backgroundColor: status.type === "success" ? "#d1e7dd" : "#f8d7da",
          border: status.type === "success" ? "1px solid #badbcc" : "1px solid #f5c2c7"
        }}>
          {status.message}
        </p>
      )}
    </form>
  );
}

export default VendorSettingsPage;
