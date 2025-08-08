import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase/config"; // Asegúrate de exportar 'auth' desde tu archivo de configuración de Firebase
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Definimos los precios por defecto con los nuevos campos
const defaultPrices = {
  precio_dia_adulto: 17,
  precio_estancia_un_dia: 10,
  precio_una_noche: 22,
  precio_agosto: 18,
  precio_larga_estancia: 10,
  descuento_perro_adicional: 0.5, // He cambiado esto a 0.5 para que represente un 50%
};

const PreciosScreen = () => {
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState(defaultPrices);
  const [userRole, setUserRole] = useState(null); // Nuevo estado para el rol del usuario
  const docRef = doc(db, "prices", "tarifas2");

  useEffect(() => {
    // Escuchar cambios en el estado de autenticación para obtener el rol del usuario
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserRole(userDocSnap.data().role || "user");
        } else {
          setUserRole("user"); // valor por defecto si no hay documento
        }
      } else {
        setUserRole("user"); // Si no hay usuario, el rol es 'user' por defecto
      }
    });

    const fetchPrices = async () => {
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setPrices(docSnap.data());
      } else {
        console.log(
          "Documento de precios 'tarifas' no encontrado, creando uno nuevo..."
        );
        await setDoc(docRef, defaultPrices);
        setPrices(defaultPrices);
      }
      setLoading(false);
    };
    fetchPrices();

    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPrices((prevPrices) => ({
      ...prevPrices,
      [name]: Number(value),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (userRole !== "admin") {
      alert("No tienes permisos para editar los precios.");
      return;
    }

    setLoading(true);
    try {
      await setDoc(docRef, prices);
      alert("Precios actualizados con éxito!");
    } catch (error) {
      console.error("Error al guardar los precios: ", error);
      alert("Error al guardar los precios.");
    } finally {
      setLoading(false);
    }
  };

  if (loading || userRole === null) {
    return <div className="p-4 text-center">Cargando precios...</div>;
  }

  // Deshabilitar los inputs si el rol no es 'admin'
  const isDisabled = userRole !== "admin";

  return (
    <div className="p-4 pb-16 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Configuración de Precios
      </h1>
      <form onSubmit={handleSave} className="space-y-4">
        <label className="block">
          <span className="text-gray-700">Precio por + noche</span>
          <input
            type="number"
            name="precio_dia_adulto"
            value={prices.precio_dia_adulto}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            disabled={isDisabled}
          />
        </label>
        <label className="block">
          <span className="text-gray-700">Precio por 1 noche</span>
          <input
            type="number"
            name="precio_una_noche"
            value={prices.precio_una_noche}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            disabled={isDisabled}
          />
        </label>
        <label className="block">
          <span className="text-gray-700">Precio pasar dia</span>
          <input
            type="number"
            name="precio_estancia_un_dia"
            value={prices.precio_estancia_un_dia}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            disabled={isDisabled}
          />
        </label>
        <label className="block">
          <span className="text-gray-700">Precio Agosto</span>
          <input
            type="number"
            name="precio_agosto"
            value={prices.precio_agosto}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            disabled={isDisabled}
          />
        </label>
        <label className="block">
          <span className="text-gray-700">Precio larga estancia</span>
          <input
            type="number"
            name="precio_larga_estancia"
            value={prices.precio_larga_estancia}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            disabled={isDisabled}
          />
        </label>
        <label className="block">
          <span className="text-gray-700">Descuento perro adicional</span>
          <input
            type="number"
            name="descuento_perro_adicional"
            value={prices.descuento_perro_adicional}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            disabled={isDisabled}
          />
        </label>
        {!isDisabled && (
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
            disabled={loading}
          >
            {loading ? "Guardando..." : "Guardar Precios"}
          </button>
        )}
      </form>
    </div>
  );
};

export default PreciosScreen;
