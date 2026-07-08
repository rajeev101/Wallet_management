const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URLS = configuredApiBaseUrl
  ? [configuredApiBaseUrl]
  : ["http://127.0.0.1:5050/api/v1", "http://127.0.0.1:5000/api/v1"];

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

export const createPayment = (payload, token) =>
  request("/auth/payment", payload, { method: "POST", token });

export const getNotifications = (token) =>
  request("/auth/notifications", undefined, { method: "GET", token });
