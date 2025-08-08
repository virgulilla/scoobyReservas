// Comentario: Botonera inferior con tab adicional "Mapa" (solo admin)
import React from "react";
import { NavLink } from "react-router-dom";

const BottomTabs = ({ isAdmin }) => {
  const baseClasses =
    "flex flex-col items-center p-2 text-gray-500 hover:text-blue-500 transition-colors flex-shrink-0 w-20";
  const activeClasses = "text-blue-500 border-t-2 border-blue-500";

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-lg">
      {/* Comentario: contenedor con scroll horizontal */}
      <div className="flex overflow-x-auto flex-nowrap">
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

        {/* Comentario: tabs solo para administradores */}
        {isAdmin && (
          <>
            <NavLink
              to="/mapa"
              className={({ isActive }) =>
                `${baseClasses} ${isActive ? activeClasses : ""}`
              }
            >
              🗺️ <span className="text-xs">Mapa</span>
            </NavLink>

            <NavLink
              to="/reportes"
              className={({ isActive }) =>
                `${baseClasses} ${isActive ? activeClasses : ""}`
              }
            >
              📈 <span className="text-xs">Reportes</span>
            </NavLink>

            <NavLink
              to="/gestion-clientes"
              className={({ isActive }) =>
                `${baseClasses} ${isActive ? activeClasses : ""}`
              }
            >
              👥 <span className="text-xs">Clientes</span>
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
};

export default BottomTabs;
