// App.jsx (lazy routes + Suspense)
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import React, { Suspense, lazy } from "react";
const LoginScreen = lazy(() => import("./pages/LoginScreen"));
const MainLayout = lazy(() => import("./components/MainLayout"));
const CalendarioScreen = lazy(() => import("./pages/CalendarioScreen"));
const NuevaReservaScreen = lazy(() => import("./pages/NuevaReservaScreen"));
const PreciosScreen = lazy(() => import("./pages/PreciosScreen"));
const ReportesScreen = lazy(() => import("./pages/ReportesScreen"));
const ComidasScreen = lazy(() => import("./pages/ComidasScreen"));
const GestionClientesScreen = lazy(() =>
  import("./pages/GestionClientesScreen")
);
const MapaScreen = lazy(() => import("./pages/MapaScreen"));
const MorososScreen = lazy(() => import("./pages/MorososScreen"));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="p-4">Cargando…</div>}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<CalendarioScreen />} />
            <Route path="calendario" element={<CalendarioScreen />} />
            <Route path="precios" element={<PreciosScreen />} />
            <Route path="reportes" element={<ReportesScreen />} />
            <Route path="comidas" element={<ComidasScreen />} />
            <Route path="/morosos" element={<MorososScreen />} />
            <Route path="mapa" element={<MapaScreen />} />
            <Route path="nueva-reserva" element={<NuevaReservaScreen />} />
            <Route
              path="gestion-clientes"
              element={<GestionClientesScreen />}
            />
            <Route
              path="editar-reserva/:bookingId"
              element={<NuevaReservaScreen />}
            />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}
export default App;
