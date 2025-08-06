import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate, Outlet } from "react-router-dom"; // Importamos Outlet
import { auth } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";

import BottomTabs from "./BottomTabs";
// No necesitas importar las páginas aquí, ya se importan en App.jsx

const MainLayout = () => {
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const role = localStorage.getItem("userRole");
        setUserRole(role);
      } else {
        navigate("/login");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (userRole === null) {
    return <div>Cargando...</div>;
  }

  const isAdmin = userRole === "admin";

  return (
    <div className="flex flex-col h-screen">
      {" "}
      <div className="flex-grow overflow-y-auto">
        {/* Aquí se renderiza la ruta hija activa */}
        <Outlet />{" "}
      </div>
      <BottomTabs isAdmin={isAdmin} />{" "}
    </div>
  );
};

export default MainLayout;
