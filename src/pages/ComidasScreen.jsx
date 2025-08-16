// Comentario: Comidas optimizado con prioridad. Usa caché global y minimiza lecturas.
import React, { useEffect, useMemo, useState } from "react";
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
import { useApp } from "../state/AppContext";

const chunk = (arr, size = 10) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

// Comentario: util local yyyy-mm-dd
const toYmd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const ComidasScreen = () => {
  const { clientNameCache } = useApp();

  const [items, setItems] = useState([]); // Comentario: [{id, nombre, haComido, esPrioridad}]
  const [loading, setLoading] = useState(true);
  const [cacheTick, setCacheTick] = useState(0); // Comentario: re-render tras llenar caché

  // Comentario: cargar reservas activas hoy que pernoctan (salida > hoy)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const today = new Date();
      const dateString = toYmd(today);

      const bookingsQuery = query(
        collection(db, "reservations"),
        where("fecha_entrada", "<=", dateString),
        where("fecha_salida", ">=", dateString)
      );
      const snap = await getDocs(bookingsQuery);

      const bookings = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => !b.is_cancelada && b.fecha_salida > dateString);

      // Comentario: resolver nombres faltantes en caché
      const ids = Array.from(
        new Set(
          bookings
            .map((b) => b.id_cliente)
            .filter((id) => typeof id === "string" && id.length > 0)
        )
      );
      const missing = ids.filter((id) => !clientNameCache.has(id));
      if (missing.length > 0) {
        for (const group of chunk(missing, 10)) {
          const clientsSnap = await getDocs(
            query(collection(db, "clients"), where("__name__", "in", group))
          );
          clientsSnap.forEach((cDoc) => {
            const c = cDoc.data();
            const nombrePerro =
              c?.perro_nombre ?? c?.nombre_perro ?? c?.dog_name ?? null;
            if (nombrePerro) clientNameCache.set(cDoc.id, nombrePerro);
          });
        }
        setCacheTick((t) => t + 1);
      }

      // Comentario: construir lista final con nombre desde caché y fallback
      const list = bookings
        .map((b) => ({
          id: b.id,
          nombre:
            (b.id_cliente && clientNameCache.get(b.id_cliente)) ||
            b.perro_nombre ||
            "Sin nombre",
          haComido: !!b.ha_comido,
          esPrioridad: !!b.prioridad_comida,
        }))
        // Comentario: ordenar por prioridad desc y luego alfabético
        .sort((a, b) => {
          if (a.esPrioridad !== b.esPrioridad) return a.esPrioridad ? -1 : 1;
          return a.nombre.localeCompare(b.nombre, "es", {
            sensitivity: "base",
          });
        });

      setItems(list);
      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheTick]);

  const pendientes = useMemo(
    () => items.reduce((acc, p) => acc + (p.haComido ? 0 : 1), 0),
    [items]
  );

  const toggleComido = async (perroId, haComidoActual) => {
    try {
      await updateDoc(doc(db, "reservations", perroId), {
        ha_comido: !haComidoActual,
      });
      setItems((prev) =>
        prev
          .map((p) =>
            p.id === perroId ? { ...p, haComido: !haComidoActual } : p
          )
          // Comentario: reordenar tras cambio por si afecta a la prioridad visible
          .sort((a, b) => {
            if (a.esPrioridad !== b.esPrioridad) return a.esPrioridad ? -1 : 1;
            return a.nombre.localeCompare(b.nombre, "es", {
              sensitivity: "base",
            });
          })
      );
    } catch (error) {
      console.error("Error al actualizar el estado de la comida:", error);
    }
  };

  const togglePrioridad = async (perroId, esPrioridadActual) => {
    try {
      await updateDoc(doc(db, "reservations", perroId), {
        prioridad_comida: !esPrioridadActual,
      });
      setItems((prev) =>
        prev
          .map((p) =>
            p.id === perroId ? { ...p, esPrioridad: !esPrioridadActual } : p
          )
          // Comentario: reordenar porque prioridad cambia el orden
          .sort((a, b) => {
            if (a.esPrioridad !== b.esPrioridad) return a.esPrioridad ? -1 : 1;
            return a.nombre.localeCompare(b.nombre, "es", {
              sensitivity: "base",
            });
          })
      );
    } catch (error) {
      console.error("Error al actualizar la prioridad:", error);
    }
  };

  // Comentario: desmarca comida y prioridad para todas las reservas pernoctando hoy
  const uncheckAll = async () => {
    const today = new Date();
    const dateString = toYmd(today);

    // Comentario: base: pernoctando hoy y no canceladas
    const baseQuery = query(
      collection(db, "reservations"),
      where("fecha_salida", ">=", dateString),
      where("is_cancelada", "==", false)
    );

    try {
      // Comentario: dos consultas para evitar OR; unimos resultados
      const [comidoSnap, prioSnap] = await Promise.all([
        getDocs(query(baseQuery, where("ha_comido", "==", true))),
        getDocs(query(baseQuery, where("prioridad_comida", "==", true))),
      ]);

      const toUpdate = new Map(); // Comentario: id -> ref
      comidoSnap.forEach((d) => toUpdate.set(d.id, d.ref));
      prioSnap.forEach((d) => toUpdate.set(d.id, d.ref));

      if (toUpdate.size > 0) {
        const batch = writeBatch(db);
        toUpdate.forEach((ref) =>
          batch.update(ref, { ha_comido: false, prioridad_comida: false })
        );
        await batch.commit();
      }

      // Comentario: refresco local
      setItems((prev) =>
        prev.map((p) => ({ ...p, haComido: false, esPrioridad: false }))
      );
    } catch (error) {
      console.error("Error al desmarcar todas las reservas:", error);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Cargando perros...</div>;
  }

  return (
    <div className="p-4 pb-16 bg-gray-100 min-h-dvh w-full max-w-full overflow-x-hidden">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Control de Comidas del Día
      </h1>

      {items.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={uncheckAll}
            className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-red-600 transition-colors"
          >
            Desmarcar todos
          </button>

          {/* Comentario: Badge con pendientes */}
          <span
            className={`inline-flex items-center text-sm font-semibold px-3 py-1 rounded-full ${
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
        {items.length > 0 ? (
          items.map((perro) => (
            <div key={perro.id} className="overflow-hidden rounded-lg">
              <SwipeItem
                key={perro.id}
                onConfirm={() => toggleComido(perro.id, perro.haComido)}
                threshold={96}
                completed={perro.haComido}
                className={`w-full p-4 rounded-lg shadow-sm transition-colors ${
                  perro.haComido
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-gray-800"
                }`}
                style={{
                  contain: "layout paint", // Comentario: aísla el layout del swipe
                  touchAction: "pan-y", // Comentario: evita scroll horizontal del documento
                  overscrollBehaviorX: "contain", // Comentario: suprime rebote lateral iOS
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Comentario: botón de estrella. Solo interactivo si NO ha comido */}
                    <button
                      type="button"
                      onClick={() =>
                        !perro.haComido &&
                        togglePrioridad(perro.id, perro.esPrioridad)
                      }
                      aria-label={
                        perro.esPrioridad
                          ? "Quitar prioridad de comida"
                          : "Marcar como prioridad de comida"
                      }
                      className={`p-1 rounded focus:outline-none focus:ring ${
                        perro.haComido
                          ? "cursor-not-allowed opacity-40"
                          : "hover:opacity-80"
                      }`}
                      disabled={perro.haComido}
                    >
                      {/* Comentario: estrella rellena si esPrioridad, contorno si no */}
                      {perro.esPrioridad ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className={`w-6 h-6 ${
                            perro.haComido ? "text-white" : "text-amber-500"
                          }`}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l2.118 6.54h6.886c.969 0 1.371 1.24.588 1.81l-5.57 4.05 2.118 6.54c.3.921-.755 1.688-1.54 1.118l-5.57-4.05-5.57 4.05c-.784.57-1.838-.197-1.539-1.118l2.118-6.54-5.57-4.05c-.783-.57-.38-1.81.588-1.81h6.885l2.118-6.54z"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          className={`w-6 h-6 ${
                            perro.haComido ? "text-white" : "text-amber-500"
                          }`}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l2.118 6.54h6.886c.969 0 1.371 1.24.588 1.81l-5.57 4.05 2.118 6.54c.3.921-.755 1.688-1.54 1.118l-5.57-4.05-5.57 4.05c-.784.57-1.838-.197-1.539-1.118l2.118-6.54-5.57-4.05c-.783-.57-.38-1.81.588-1.81h6.885l2.118-6.54z"
                          />
                        </svg>
                      )}
                    </button>

                    <p
                      className={`font-semibold text-lg ${
                        perro.haComido ? "line-through" : ""
                      }`}
                    >
                      {perro.nombre}
                    </p>
                  </div>

                  <span
                    className={`text-xs select-none ${
                      perro.haComido ? "opacity-80" : "text-gray-400"
                    }`}
                  >
                    Desliza ➔
                  </span>
                </div>
              </SwipeItem>
            </div>
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
