// src/store/slices/authSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { authAPI } from "@/lib/Api";

export const loginUser = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const res = await authAPI.login(credentials);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Login failed");
    }
  },
);

export const registerUser = createAsyncThunk(
  "auth/register",
  async (userData, { rejectWithValue }) => {
    try {
      const res = await authAPI.register(userData);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || "Registration failed",
      );
    }
  },
);

export const fetchCurrentUser = createAsyncThunk(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const res = await authAPI.me();
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Session expired");
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: localStorage.getItem("token") || null,
    loading: false,
    error: null,
    initialized: false,
    guestMode: false,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.error = null;
      state.guestMode = false;
      localStorage.removeItem("token");
    },
    clearError: (state) => {
      state.error = null;
    },
    enableGuestMode: (state) => {
      state.guestMode = true;
      state.user = { username: "Guest" };
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginUser.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(loginUser.fulfilled, (s, a) => {
        s.loading = false;
        s.guestMode = false;
        s.token = a.payload.access_token;
        s.user = {
          id: a.payload.user_id,
          username: a.payload.username,
          email: a.payload.email,
        };
        localStorage.setItem("token", a.payload.access_token);
      })
      .addCase(loginUser.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      });

    // Register
    builder
      .addCase(registerUser.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(registerUser.fulfilled, (s, a) => {
        s.loading = false;
        s.guestMode = false;
        s.token = a.payload.access_token;
        s.user = {
          id: a.payload.user_id,
          username: a.payload.username,
          email: a.payload.email,
        };
        localStorage.setItem("token", a.payload.access_token);
      })
      .addCase(registerUser.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      });

    // Fetch Me
    builder
      .addCase(fetchCurrentUser.pending, (s) => {
        s.loading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (s, a) => {
        s.loading = false;
        s.user = {
          id: a.payload.user_id,
          username: a.payload.username,
          email: a.payload.email,
        };
        s.initialized = true;
      })
      .addCase(fetchCurrentUser.rejected, (s) => {
        s.loading = false;
        s.user = null;
        s.token = null;
        s.initialized = true;
        localStorage.removeItem("token");
      });
  },
});

export const { logout, clearError, enableGuestMode } = authSlice.actions;
export default authSlice.reducer;
