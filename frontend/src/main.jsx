// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import store from "./store/Index";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#0d1117",
              color: "#e8edf5",
              border: "1px solid #232d3f",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "0.875rem",
              borderRadius: "10px",
            },
            success: {
              iconTheme: { primary: "#34d399", secondary: "#0d1117" },
            },
            error: { iconTheme: { primary: "#fb7185", secondary: "#0d1117" } },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
