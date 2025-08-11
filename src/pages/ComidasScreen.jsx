import React, { useState, useEffect } from "react";
import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import SwipeItem from "../components/SwipeItem";

const ComidasScreen = () => {
  const [perrosPernoctando, setPerrosPernoctando] = useState([]);
  const [loading, setLoading] = useState(true);

  // Comentario: util para trocear en lotes (límite 'in' = 10)
  const chunk = (arr, size = 10) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );

  const fetchPerrosPernoctando = async () => {
    setLoading(true);
    try {
      // Comentario: fecha de hoy en formato yyyy-mm-dd
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;

      // Comentario: reservas activas hoy
      const bookingsQuery = query(
        collection(db, "reservations"),
        where("fecha_entrada", "<=", dateString),
        where("fecha_salida", ">=", dateString)
      );
      const snap = await getDocs(bookingsQuery);

      // Comentario: filtrar canceladas y que pernoctan (salida > hoy)
      const bookings = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => !b.is_cancelada && b.fecha_salida > dateString);

      // Comentario: recolectar ids de cliente presentes
      const clientIds = Array.from(
        new Set(
          bookings
            .map((b) => b.id_cliente)
            .filter((id) => typeof id === "string" && id.length > 0)
        )
      );

      // Comentario: mapa id_cliente -> nombre_perro desde clients
      const clientDogNames = {};
      if (clientIds.length > 0) {
        for (const group of chunk(clientIds, 10)) {
          const clientsSnap = await getDocs(
            query(collection(db, "clients"), where("__name__", "in", group))
          );
          clientsSnap.forEach((cDoc) => {
            const c = cDoc.data();
            // Comentario: soportar variantes de campo
            const nombrePerro =
              c?.perro_nombre ?? c?.nombre_perro ?? c?.dog_name ?? null;
            if (nombrePerro) clientDogNames[cDoc.id] = nombrePerro;
          });
        }
      }

      // Comentario: construir lista final con nombre desde clients y fallback
      const pernoctando = bookings
        .map((b) => ({
          id: b.id,
          nombre:
            (b.id_cliente && clientDogNames[b.id_cliente]) ||
            b.perro_nombre ||
            "Sin nombre",
          haComido: !!b.ha_comido,
        }))
        // Comentario: ordenar por nombre mostrado
        .sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
        );

      setPerrosPernoctando(pernoctando);
    } catch (e) {
      console.error("Error al cargar pernoctas:", e);
      setPerrosPernoctando([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleComido = async (perroId, haComidoActual) => {
    const perroDocRef = doc(db, "reservations", perroId);

    try {
      await updateDoc(perroDocRef, {
        ha_comido: !haComidoActual,
      });

      setPerrosPernoctando(
        perrosPernoctando.map((perro) =>
          perro.id === perroId ? { ...perro, haComido: !haComidoActual } : perro
        )
      );
    } catch (error) {
      console.error("Error al actualizar el estado de la comida:", error);
    }
  };

  const uncheckAll = async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;

    // Obtener las reservas que pernoctan, que están marcadas y que NO han sido canceladas
    const pernoctandoQuery = query(
      collection(db, "reservations"),
      where("fecha_salida", ">=", dateString),
      where("ha_comido", "==", true),
      where("is_cancelada", "==", false)
    );

    try {
      const querySnapshot = await getDocs(pernoctandoQuery);
      if (querySnapshot.size > 0) {
        const batch = writeBatch(db);
        querySnapshot.forEach((document) => {
          batch.update(document.ref, { ha_comido: false });
        });
        await batch.commit();
        console.log(`Desmarcadas ${querySnapshot.size} reservas.`);
        fetchPerrosPernoctando();
      }
    } catch (error) {
      console.error("Error al desmarcar todas las reservas:", error);
    }
  };

  useEffect(() => {
    fetchPerrosPernoctando();
  }, []);

  if (loading) {
    return <div className="p-4 text-center">Cargando perros...</div>;
  }

  const pendientes = perrosPernoctando.reduce(
    (acc, p) => acc + (p.haComido ? 0 : 1),
    0
  );

  return (
    <div className="p-4 pb-16 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Control de Comidas del Día
      </h1>

      {perrosPernoctando.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={uncheckAll}
            className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-red-600 transition-colors"
          >
            Desmarcar todos
          </button>

          {/* 🔔 Badge con pendientes */}
          <span
            className={`inline-flex items-center text-sm font-semibold px-3 py-1 rounded-full
        ${
          pendientes > 0
            ? "bg-amber-100 text-amber-800"
            : "bg-emerald-100 text-emerald-800"
        }`}
            aria-live="polite"
          >
            Pendientes: {pendientes}
          </span>
        </div>
      )}

      <div className="space-y-4">
        {perrosPernoctando.length > 0 ? (
          perrosPernoctando.map((perro) => (
            <SwipeItem
              key={perro.id} // ✅ clave única por ítem
              onConfirm={() => toggleComido(perro.id, perro.haComido)}
              threshold={96} // 👉 un pelín más intencional
              completed={perro.haComido}
              className={`p-4 rounded-lg shadow-sm transition-colors ${
                perro.haComido
                  ? "bg-emerald-500 text-white" // ✅ fondo cuando ha comido
                  : "bg-white text-gray-800" // ⬜️ fondo por defecto
              }`}
            >
              <div className="flex items-center justify-between">
                <p
                  className={`font-semibold text-lg ${
                    perro.haComido ? "line-through" : ""
                  }`}
                >
                  {perro.nombre}
                </p>
                <span
                  className={`text-xs select-none ${
                    perro.haComido ? "opacity-80" : "text-gray-400"
                  }`}
                >
                  Desliza ➔
                </span>
              </div>
            </SwipeItem>
          ))
        ) : (
          <p className="text-center text-gray-500">
            No hay perros pernoctando hoy.
          </p>
        )}
      </div>
    </div>
  );
};

export default ComidasScreen;
