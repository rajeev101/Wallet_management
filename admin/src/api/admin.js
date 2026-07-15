const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5050/api/v1";

const getToken = () => localStorage.getItem("cpacToken");

const request = async (path, payload, options = {}) => {
  const requestOptions = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  };

  if (payload !== undefined) {
    requestOptions.body = JSON.stringify(payload);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, requestOptions);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
};

export const getAdminStats = () => request("/admin/stats");

export const getAdminStudents = (search = "") =>
  request(`/admin/students${search ? `?search=${encodeURIComponent(search)}` : ""}`);

export const getAdminVendors = (search = "") =>
  request(`/admin/vendors${search ? `?search=${encodeURIComponent(search)}` : ""}`);

export const approveVendor = (id) =>
  request(`/admin/vendor/${id}/approve`, undefined, { method: "PUT" });

export const rejectVendor = (id) =>
  request(`/admin/vendor/${id}/reject`, undefined, { method: "PUT" });

export const addMoneyToStudent = (payload) =>
  request("/admin/add-money", payload, { method: "POST" });

export const getAdminTransactions = (vendorId = "") =>
  request(`/admin/transactions${vendorId ? `?vendorId=${encodeURIComponent(vendorId)}` : ""}`);

export const getAdminWalletRequests = () => request("/admin/wallet/requests");

export const updateWalletRequestStatus = (id, payload) =>
  request(`/admin/wallet/request/${id}`, payload, { method: "PUT" });

export const getNotifications = () => request("/auth/notifications");

export const clearNotifications = () =>
  request("/auth/notifications", undefined, { method: "DELETE" });
