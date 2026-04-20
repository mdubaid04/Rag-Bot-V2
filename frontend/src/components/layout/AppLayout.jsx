// src/components/layout/AppLayout.jsx
import { Outlet } from "react-router-dom";
import Sidebar from "./SideBar";

export default function AppLayout() {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at 50% 0%, #0a2a2a 0%, #071a1a 40%, #050f0f 100%)",
      }}
    >
      <Sidebar />
      <main style={{ flex: 1, overflow: "hidden" }}>
        <Outlet />
      </main>
    </div>
  );
}
