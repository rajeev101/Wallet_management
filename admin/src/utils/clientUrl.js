export const getClientUrl = (path) => {
  const productionOrigin = new URL(window.location.origin);
  if (productionOrigin.port === "3001") productionOrigin.port = "";
  const base = import.meta.env.VITE_CLIENT_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : productionOrigin.origin);
  return new URL(path, base).href;
};