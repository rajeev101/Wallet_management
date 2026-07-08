const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URLS = configuredApiBaseUrl
  ? [configuredApiBaseUrl]
  : ["http://127.0.0.1:5050/api/v1", "http://127.0.0.1:5000/api/v1"];

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

  let response;
  let networkError;

  for (const baseUrl of API_BASE_URLS) {
    try {
      response = await fetch(`${baseUrl}${path}`, requestOptions);
      break;
    } catch (error) {
      networkError = error;
    }
  }

  if (!response) {
    throw new Error(networkError?.message || "API server is not reachable");
  }

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

export const getAdminTransactions = () => request("/admin/transactions");

export const getAdminNotifications = () => request("/admin/notifications");

export const getAdminWalletRequests = () => request("/admin/wallet/requests");

export const updateWalletRequestStatus = (id, payload) =>
  request(`/admin/wallet/request/${id}`, payload, { method: "PUT" });
