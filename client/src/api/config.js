const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const getApiBaseUrl = () => API_BASE_URL;

export const getApiPath = (path) => {
  return path.startsWith('/') ? path : `/${path}`;
};

export const buildApiUrl = (path) => `${getApiBaseUrl()}${getApiPath(path)}`;

export const getSocketUrl = () => {
  // If explicitly configured, use that
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  // In development, use the backend directly (not through Vite proxy for WebSocket)
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }

  // In production, use same-origin (will resolve to the current domain)
  return undefined;
};
