import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginScreen from "./pages/LoginScreen";
import MainLayout from "./components/MainLayout";
import CalendarioScreen from "./pages/CalendarioScreen";
import NuevaReservaScreen from "./pages/NuevaReservaScreen";
import PreciosScreen from "./pages/PreciosScreen";
import ReportesScreen from "./pages/ReportesScreen";
import ComidasScreen from "./pages/ComidasScreen";
import GestionClientesScreen from "./pages/GestionClientesScreen"; // Importa el nuevo componente

// Componente de marcador de posición para la gestión de clientes
// Puedes reemplazar esto con la lógica real de la página
const PlaceholderGestionClientesScreen = () => {
  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>
        Gestión de Clientes
      </h1>
      <p style={{ marginTop: "10px" }}>
        Aquí se mostrará la interfaz para buscar, crear y ver clientes.
      </p>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        {/* La ruta de login se mantiene fuera del layout */}
        <Route path="/login" element={<LoginScreen />} />

        {/* La ruta principal ahora usará el MainLayout */}
        <Route path="/" element={<MainLayout />}>
          {/* Todas las rutas anidadas a partir de aquí usarán el MainLayout */}
          <Route index element={<CalendarioScreen />} />{" "}
          {/* Ruta por defecto */}
          <Route path="calendario" element={<CalendarioScreen />} />
          <Route path="precios" element={<PreciosScreen />} />
          <Route path="reportes" element={<ReportesScreen />} />
          <Route path="comidas" element={<ComidasScreen />} />{" "}
          {/* ¡Nueva ruta añadida! */}
          <Route path="nueva-reserva" element={<NuevaReservaScreen />} />
          <Route path="gestion-clientes" element={<GestionClientesScreen />} />
          {/* Añadimos la ruta de gestión de clientes */}
          <Route
            path="editar-reserva/:bookingId"
            element={<NuevaReservaScreen />}
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
