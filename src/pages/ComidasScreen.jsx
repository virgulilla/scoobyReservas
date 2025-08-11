// Comentario: Comidas optimizado. Usa caché global de clients para nombres y minimiza lecturas.
// - Carga reservas activas hoy que pernoctan y construye la lista con nombres desde caché.
// - Sólo consulta clients faltantes en lotes de 10.
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

  const [items, setItems] = useState([]); // Comentario: [{id, nombre, haComido}]
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
        }))
        .sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
        );

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
        prev.map((p) =>
          p.id === perroId ? { ...p, haComido: !haComidoActual } : p
        )
      );
    } catch (error) {
      console.error("Error al actualizar el estado de la comida:", error);
    }
  };

  const uncheckAll = async () => {
    const today = new Date();
    const dateString = toYmd(today);

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
        // Comentario: refresco local
        setItems((prev) => prev.map((p) => ({ ...p, haComido: false })));
      }
    } catch (error) {
      console.error("Error al desmarcar todas las reservas:", error);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Cargando perros...</div>;
  }

  return (
    <div className="p-4 pb-16 bg-gray-100 min-h-screen">
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
            <SwipeItem
              key={perro.id}
              onConfirm={() => toggleComido(perro.id, perro.haComido)}
              threshold={96}
              completed={perro.haComido}
              className={`p-4 rounded-lg shadow-sm transition-colors ${
                perro.haComido
                  ? "bg-emerald-500 text-white"
                  : "bg-white text-gray-800"
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
