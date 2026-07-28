// Centralized API configuration.
// VITE_API_URL is injected at build time (see frontend/.env or your hosting
// provider's environment variable settings). Falls back to localhost for
// local development if it isn't set.
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const API = `${API_BASE}/api/v1`;
export const SOCKET_URL = API_BASE;
