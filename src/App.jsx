import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginScreen from "./pages/LoginScreen";
import MainLayout from "./components/MainLayout";
import CalendarioScreen from "./pages/CalendarioScreen";
import NuevaReservaScreen from "./pages/NuevaReservaScreen";
import PreciosScreen from "./pages/PreciosScreen";
import ReportesScreen from "./pages/ReportesScreen";
import ComidasScreen from "./pages/ComidasScreen";
import GestionClientesScreen from "./pages/GestionClientesScreen";
import MapaScreen from "./pages/MapaScreen"; // Comentario: nueva importación

function App() {
  return (
    <Router>
      <Routes>
        {/* Comentario: login fuera del layout principal */}
        <Route path="/login" element={<LoginScreen />} />

        {/* Comentario: rutas con layout principal */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<CalendarioScreen />} />
          <Route path="calendario" element={<CalendarioScreen />} />
          <Route path="precios" element={<PreciosScreen />} />
          <Route path="reportes" element={<ReportesScreen />} />
          <Route path="comidas" element={<ComidasScreen />} />
          <Route path="mapa" element={<MapaScreen />} />{" "}
          {/* Comentario: NUEVA RUTA */}
          <Route path="nueva-reserva" element={<NuevaReservaScreen />} />
          <Route path="gestion-clientes" element={<GestionClientesScreen />} />
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
