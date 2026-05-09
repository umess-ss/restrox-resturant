const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const getApiBaseUrl = () => API_BASE_URL;

export const getApiPath = (path) => {
  return path.startsWith('/') ? path : `/${path}`;
};

export const buildApiUrl = (path) => `${getApiBaseUrl()}${getApiPath(path)}`;

export const getSocketUrl = () => {
  return import.meta.env.VITE_SOCKET_URL || undefined;
};
