import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import BottomTabs from "./BottomTabs";
import { useApp } from "../state/AppContext";

const MainLayout = () => {
  const { authReady, user, role } = useApp();
  const navigate = useNavigate();

  if (!authReady) return <div>Cargando…</div>;
  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-grow overflow-y-auto">
        <Outlet />
      </div>
      <BottomTabs isAdmin={role === "admin"} />
    </div>
  );
};
export default MainLayout;
