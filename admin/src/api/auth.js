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

export const adminLogin = (payload) => request("/auth/login", payload);

export const getProfile = (token) =>
  request("/auth/profile", undefined, { method: "GET", token });

export const updateProfile = (payload, token) =>
  request("/auth/profile", payload, { method: "PUT", token });
