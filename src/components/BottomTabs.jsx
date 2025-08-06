import React from "react";
import { NavLink } from "react-router-dom";

const BottomTabs = ({ isAdmin }) => {
  const baseClasses =
    "flex flex-col items-center p-2 text-gray-500 hover:text-blue-500 transition-colors";
  const activeClasses = "text-blue-500 border-t-2 border-blue-500";

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-lg">
      <div className="flex justify-around">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `${baseClasses} ${isActive ? activeClasses : ""}`
          }
        >
          🗓️ <span className="text-xs">Calendario</span>
        </NavLink>

        <NavLink
          to="/precios"
          className={({ isActive }) =>
            `${baseClasses} ${isActive ? activeClasses : ""}`
          }
        >
          💰 <span className="text-xs">Precios</span>
        </NavLink>

        <NavLink
          to="/comidas"
          className={({ isActive }) =>
            `${baseClasses} ${isActive ? activeClasses : ""}`
          }
        >
          🍗 <span className="text-xs">Comidas</span>
        </NavLink>

        {/* Tabs solo para administradores */}
        {isAdmin && (
          <>
            <NavLink
              to="/reportes"
              className={({ isActive }) =>
                `${baseClasses} ${isActive ? activeClasses : ""}`
              }
            >
              📈 <span className="text-xs">Reportes</span>
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
};

export default BottomTabs;
