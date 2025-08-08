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

const ComidasScreen = () => {
  const [perrosPernoctando, setPerrosPernoctando] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPerrosPernoctando = async () => {
    setLoading(true);
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;

    // Consulta todas las reservas que entraron en o antes de hoy
    const bookingsQuery = query(
      collection(db, "reservations"),
      where("fecha_entrada", "<=", dateString)
    );

    const querySnapshot = await getDocs(bookingsQuery);
    const pernoctando = [];
    const bookings = querySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      // Comentario: ordenar en cliente por perro_nombre alfabéticamente (case-insensitive)
      .sort((a, b) => {
        const nombreA = (a.perro_nombre || "").toLowerCase();
        const nombreB = (b.perro_nombre || "").toLowerCase();
        return nombreA.localeCompare(nombreB, "es", { sensitivity: "base" });
      });

    bookings.forEach((bookingData) => {
      // Omitir canceladas
      if (bookingData.is_cancelada) return;

      // Solo perros que siguen durmiendo después de dateString
      if (bookingData.fecha_salida > dateString) {
        pernoctando.push({
          id: bookingData.id,
          nombre: bookingData.perro_nombre,
          haComido: bookingData.ha_comido || false,
        });
      }
    });

    setPerrosPernoctando(pernoctando);
    setLoading(false);
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
      where("fecha_salida", ">", dateString),
      where("ha_comido", "==", true),
      where("is_cancelada", "==", false) // Nueva condición para excluir canceladas
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

  return (
    <div className="p-4 pb-16 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Control de Comidas del Día
      </h1>

      {perrosPernoctando.length > 0 && (
        <button
          onClick={uncheckAll}
          className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-red-600 transition-colors mb-4"
        >
          Desmarcar todos
        </button>
      )}

      <div className="space-y-4">
        {perrosPernoctando.length > 0 ? (
          perrosPernoctando.map((perro) => (
            <div
              key={perro.id}
              className={`flex items-center justify-between p-4 rounded-lg shadow-sm bg-white cursor-pointer transition-colors ${
                perro.haComido ? "bg-green-50" : ""
              }`}
              onClick={() => toggleComido(perro.id, perro.haComido)}
            >
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={perro.haComido}
                  onChange={() => toggleComido(perro.id, perro.haComido)}
                  className="form-checkbox h-5 w-5 text-indigo-600 rounded"
                />
                <p
                  className={`font-semibold text-lg ${
                    perro.haComido
                      ? "line-through text-gray-400"
                      : "text-gray-800"
                  }`}
                >
                  {perro.nombre}
                </p>
              </div>
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
