import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginScreen from "./pages/LoginScreen";
import MainLayout from "./components/MainLayout";
import CalendarioScreen from "./pages/CalendarioScreen";
import NuevaReservaScreen from "./pages/NuevaReservaScreen";
import PreciosScreen from "./pages/PreciosScreen";
import ReportesScreen from "./pages/ReportesScreen";
import ComidasScreen from "./pages/ComidasScreen"; // Importa el nuevo componente

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
          {/* Añadimos la ruta de edición con el parámetro :id */}
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
