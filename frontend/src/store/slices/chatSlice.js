// src/store/slices/chatSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { sessionsAPI, chatAPI } from "@/lib/Api";

export const fetchSessions = createAsyncThunk(
  "chat/fetchSessions",
  async (_, { rejectWithValue }) => {
    try {
      return (await sessionsAPI.getAll()).data;
    } catch (e) {
      return rejectWithValue(
        e.response?.data?.detail || "Failed to load sessions",
      );
    }
  },
);

// Session created implicitly by backend on first /chat/ call — just generate UUID locally
export const createSession = createAsyncThunk(
  "chat/createSession",
  async (title = "New Chat") => {
    return {
      session_id: crypto.randomUUID(),
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },
);

export const deleteSession = createAsyncThunk(
  "chat/deleteSession",
  async (id, { rejectWithValue }) => {
    try {
      await sessionsAPI.delete(id);
      return id;
    } catch (e) {
      return rejectWithValue(e.response?.data?.detail || "Failed to delete");
    }
  },
);

// 403/404 = new local session not yet on backend → return empty messages (not an error)
export const fetchMessages = createAsyncThunk(
  "chat/fetchMessages",
  async (sessionId, { rejectWithValue }) => {
    try {
      const res = await sessionsAPI.getMessages(sessionId);
      return { sessionId, messages: res.data };
    } catch (e) {
      if (e.response?.status === 403 || e.response?.status === 404)
        return { sessionId, messages: [] };
      return rejectWithValue(
        e.response?.data?.detail || "Failed to load messages",
      );
    }
  },
);

// POST /chat/ → { session_id, query, enable_web_search }
// Response: { response: string, trace_events: TraceEvent[] }
export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async ({ sessionId, message, webSearchEnabled }, { rejectWithValue }) => {
    try {
      const res = await chatAPI.sendMessage(
        sessionId,
        message,
        webSearchEnabled,
      );
      return {
        sessionId,
        userMessage: message,
        reply: res.data.response,
        traceEvents: res.data.trace_events || [],
      };
    } catch (e) {
      return rejectWithValue(
        e.response?.data?.detail || "Failed to send message",
      );
    }
  },
);

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    sessions: [],
    activeSessionId: null,
    messages: {}, // { [sessionId]: Message[] }
    traces: {}, // { [assistantMsgId]: TraceEvent[] }
    loading: false,
    sendingMessage: false,
    webSearchEnabled: true,
    error: null,
  },
  reducers: {
    setActiveSession: (s, a) => {
      s.activeSessionId = a.payload;
    },
    toggleWebSearch: (s) => {
      s.webSearchEnabled = !s.webSearchEnabled;
    },
    clearError: (s) => {
      s.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchSessions.pending, (s) => {
      s.loading = true;
    });
    b.addCase(fetchSessions.fulfilled, (s, a) => {
      s.loading = false;
      s.sessions = a.payload;
    });
    b.addCase(fetchSessions.rejected, (s) => {
      s.loading = false;
    });

    b.addCase(createSession.fulfilled, (s, a) => {
      s.sessions.unshift(a.payload);
      s.activeSessionId = a.payload.session_id;
      s.messages[a.payload.session_id] = [];
    });

    b.addCase(deleteSession.fulfilled, (s, a) => {
      s.sessions = s.sessions.filter((x) => x.session_id !== a.payload);
      if (s.activeSessionId === a.payload)
        s.activeSessionId = s.sessions[0]?.session_id || null;
      delete s.messages[a.payload];
    });

    b.addCase(fetchMessages.fulfilled, (s, a) => {
      s.messages[a.payload.sessionId] = a.payload.messages;
    });

    b.addCase(sendMessage.pending, (s) => {
      s.sendingMessage = true;
      s.error = null;
    });

    b.addCase(sendMessage.fulfilled, (s, a) => {
      s.sendingMessage = false;
      const { sessionId, userMessage, reply, traceEvents } = a.payload;
      const now = new Date().toISOString();
      const assistantMsgId = `a-${Date.now()}`;

      const existing = (s.messages[sessionId] || []).filter(
        (m) => !String(m.id).startsWith("opt-"),
      );
      s.messages[sessionId] = [
        ...existing,
        {
          id: `u-${Date.now()}`,
          role: "user",
          content: userMessage,
          created_at: now,
        },
        {
          id: assistantMsgId,
          role: "assistant",
          content: reply,
          created_at: now,
        },
      ];

      // Store trace_events keyed by assistant message id
      if (traceEvents?.length) {
        s.traces[assistantMsgId] = traceEvents;
      }

      // Update session in list
      const idx = s.sessions.findIndex((x) => x.session_id === sessionId);
      if (idx !== -1) {
        s.sessions[idx].updated_at = now;
        if (s.sessions[idx].title === "New Chat") {
          s.sessions[idx].title =
            userMessage.slice(0, 40) + (userMessage.length > 40 ? "..." : "");
        }
      }
    });

    b.addCase(sendMessage.rejected, (s, a) => {
      s.sendingMessage = false;
      s.error = a.payload;
      if (s.activeSessionId) {
        s.messages[s.activeSessionId] = (
          s.messages[s.activeSessionId] || []
        ).filter((m) => !String(m.id).startsWith("opt-"));
      }
    });
  },
});

export const { setActiveSession, toggleWebSearch, clearError } =
  chatSlice.actions;
export default chatSlice.reducer;
