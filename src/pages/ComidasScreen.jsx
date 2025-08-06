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

    const bookingsQuery = query(
      collection(db, "reservations"),
      where("fecha_entrada", "<=", dateString)
    );

    const querySnapshot = await getDocs(bookingsQuery);
    const pernoctando = [];

    querySnapshot.forEach((doc) => {
      const bookingData = { id: doc.id, ...doc.data() };

      if (bookingData.fecha_salida > dateString) {
        pernoctando.push({
          id: doc.id,
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

    await updateDoc(perroDocRef, {
      ha_comido: !haComidoActual,
    });

    setPerrosPernoctando(
      perrosPernoctando.map((perro) =>
        perro.id === perroId ? { ...perro, haComido: !haComidoActual } : perro
      )
    );
  };

  // Nueva función para desmarcar todos los perros
  const uncheckAll = async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;

    // Obtener solo las reservas de perros que pernoctan y que están marcadas
    const pernoctandoQuery = query(
      collection(db, "reservations"),
      where("fecha_salida", ">", dateString),
      where("ha_comido", "==", true)
    );

    const querySnapshot = await getDocs(pernoctandoQuery);

    if (querySnapshot.size > 0) {
      const batch = writeBatch(db);
      querySnapshot.forEach((document) => {
        batch.update(document.ref, { ha_comido: false });
      });
      await batch.commit();
      console.log(`Desmarcadas ${querySnapshot.size} reservas.`);
      // Refresca la lista después de actualizar Firestore
      fetchPerrosPernoctando();
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

      {/* Botón para desmarcar todos */}
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
