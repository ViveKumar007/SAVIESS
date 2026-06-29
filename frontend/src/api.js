/**
 * Centralized API configuration.
 *
 * All frontend components import API_BASE / API / SOCKET_URL from here
 * instead of hardcoding "http://localhost:5000" throughout the codebase.
 *
 * In production, set the VITE_API_URL environment variable to the
 * deployed backend origin (e.g. https://api.saviess.org).
 */

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const API = `${API_BASE}/api/v1`;
export const SOCKET_URL = API_BASE;
