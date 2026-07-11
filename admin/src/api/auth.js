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

export const adminLogin = (payload) => request("/auth/login", payload);

export const getProfile = (token) =>
  request("/auth/profile", undefined, { method: "GET", token });

export const updateProfile = (payload, token) =>
  request("/auth/profile", payload, { method: "PUT", token });
