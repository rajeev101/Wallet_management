const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5050/api/v1";

const request = async (path, payload, options = {}) => {
  const requestOptions = {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
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

export const loginUser = (payload) => request("/auth/login", payload);

export const signupUser = (payload) => request("/auth/signup", payload);

export const forgotPassword = (payload) => request("/auth/forgot-password", payload);

export const verifyOtp = (payload) => request("/auth/verify-otp", payload);

export const resetPassword = (payload) => request("/auth/reset-password", payload);

export const getProfile = (token) =>
  request("/auth/profile", undefined, { method: "GET", token });

export const updateProfile = (payload, token) =>
  request("/auth/profile", payload, { method: "PUT", token });

export const createWalletRequest = (payload, token) =>
  request("/auth/wallet/request", payload, { method: "POST", token });

export const getWalletRequests = (token) =>
  request("/auth/wallet/requests", undefined, { method: "GET", token });

export const makePayment = (payload, token) =>
  request("/auth/pay", payload, { method: "POST", token });

export const getMyTransactions = (token) =>
  request("/auth/transactions", undefined, { method: "GET", token });

export const getApprovedVendors = (token) =>
  request("/auth/vendors", undefined, { method: "GET", token });

export const getVendorById = (id, token) =>
  request(`/auth/vendors/${id}`, undefined, { method: "GET", token });
