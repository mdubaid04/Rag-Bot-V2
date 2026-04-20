// src/lib/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 60000,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

// ── Auth ─────────────────────────────────────────────────────
// POST /auth/signup  → { username, email, password }
// POST /auth/login   → { email, password }
// GET  /auth/me
export const authAPI = {
  register: (data) => api.post("/auth/signup", data),
  login: (data) => api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
};

// ── Sessions ─────────────────────────────────────────────────
// GET    /history/sessions
// GET    /history/sessions/:id/messages
// DELETE /history/sessions/:id
export const sessionsAPI = {
  getAll: () => api.get("/history/sessions"),
  delete: (id) => api.delete(`/history/sessions/${id}`),
  getMessages: (id) => api.get(`/history/sessions/${id}/messages`),
};

// ── Chat ─────────────────────────────────────────────────────
// POST /chat/  → { session_id, query, enable_web_search }
// Returns: { response: string, trace_events: [...] }
export const chatAPI = {
  sendMessage: (sessionId, query, enableWebSearch) =>
    api.post("/chat/", {
      session_id: sessionId,
      query,
      enable_web_search: enableWebSearch,
    }),
};

// ── Documents ────────────────────────────────────────────────
// POST /upload-document/  → multipart file upload
export const docsAPI = {
  uploadFile: (formData) =>
    api.post("/upload-document/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export default api;
