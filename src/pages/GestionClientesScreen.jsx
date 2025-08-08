import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  startAt,
  endAt,
  startAfter,
  endBefore,
  limit,
  limitToLast,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";

const CLIENTES_POR_PAGINA = 10;

const GestionClientesScreen = () => {
  const [clientes, setClientes] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState(null);
  const [firstDocStack, setFirstDocStack] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [nuevoCliente, setNuevoCliente] = useState({
    perro_nombre: "",
    telefono: "",
    dueño_nombre: "",
    observaciones: "",
    patio: false,
    fugista: false,
    miedoso: false,
    microxip: "",
    foto_url: "",
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [clientPhotoFile, setClientPhotoFile] = useState(null);

  const cargarClientes = async (direction = "reset") => {
    setLoading(true);
    setMensaje("");

    try {
      const clientesRef = collection(db, "clients");
      const filtroLower = filtro.toLowerCase().trim();
      let baseQuery = query(clientesRef, orderBy("perro_nombre"));

      if (filtroLower) {
        baseQuery = query(
          clientesRef,
          orderBy("perro_nombre"),
          startAt(filtroLower),
          endAt(filtroLower + "\uf8ff")
        );
      }

      let finalQuery;
      if (direction === "next" && lastVisibleDoc) {
        // Página siguiente
        finalQuery = query(
          baseQuery,
          startAfter(lastVisibleDoc),
          limit(CLIENTES_POR_PAGINA)
        );
      } else if (direction === "prev" && firstVisibleDoc) {
        // Página anterior: usar endBefore + limitToLast
        finalQuery = query(
          baseQuery,
          endBefore(firstVisibleDoc),
          limitToLast(CLIENTES_POR_PAGINA)
        );
      } else {
        // Reset / primera página
        finalQuery = query(baseQuery, limit(CLIENTES_POR_PAGINA));
      }

      const snapshot = await getDocs(finalQuery);
      const docs = snapshot.docs;

      const resultados = docs.map((d) => ({ id: d.id, ...d.data() }));

      setClientes(resultados);
      const firstDoc = docs[0] ?? null;
      const lastDoc = docs[docs.length - 1] ?? null;
      setFirstVisibleDoc(firstDoc);
      setLastVisibleDoc(lastDoc);

      // Mantén la pila para volver atrás
      if (direction === "next") {
        // Empuja el "first" de la nueva página
        if (firstDoc) setFirstDocStack((prev) => [...prev, firstDoc]);
      } else if (direction === "prev") {
        // Volver atrás: saca el tope actual (el que acabamos de dejar)
        setFirstDocStack((prev) =>
          prev.length > 1 ? prev.slice(0, -1) : prev
        );
      } else {
        // Reset de filtros/búsqueda: reinicia pila con el first actual
        setFirstDocStack(firstDoc ? [firstDoc] : []);
      }
    } catch (error) {
      console.error("Error al cargar clientes:", error);
      setMensaje("Error al cargar los clientes.");
    }

    setLoading(false);
  };

  useEffect(() => {
    cargarClientes("reset");
  }, []);

  const handleFiltroChange = (e) => {
    setFiltro(e.target.value);
  };

  const handleBuscar = (e) => {
    e.preventDefault();
    setLastVisibleDoc(null);
    setFirstVisibleDoc(null);
    setFirstDocStack([]);
    cargarClientes("reset");
  };

  const handleInputChange = (e) => {
    const { name, type, value, checked } = e.target;
    setNuevoCliente((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setClientPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const uploadPhotoToCloudinary = async (file) => {
    const cloudName = "denlgwyus";
    const uploadPreset = "mis-mascotas";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );
    const data = await res.json();
    return data.secure_url;
  };

  const handleGuardarCliente = async () => {
    setLoading(true);
    try {
      let photoURL = nuevoCliente.foto_url;
      if (clientPhotoFile) {
        photoURL = await uploadPhotoToCloudinary(clientPhotoFile);
      }

      const data = {
        ...nuevoCliente,
        perro_nombre: nuevoCliente.perro_nombre.toLowerCase(),
        foto_url: photoURL,
      };

      if (selectedClient) {
        const ref = doc(db, "clients", selectedClient.id);
        await updateDoc(ref, data);
        setMensaje("Cliente actualizado.");
      } else {
        await addDoc(collection(db, "clients"), data);
        setMensaje("Cliente creado.");
      }

      setNuevoCliente({
        perro_nombre: "",
        telefono: "",
        dueño_nombre: "",
        observaciones: "",
        patio: false,
        fugista: false,
        miedoso: false,
        microxip: "",
        foto_url: "",
      });
      setSelectedClient(null);
      setClientPhotoFile(null);
      setPhotoPreview(null);
      cargarClientes();
    } catch (error) {
      console.error("Error al guardar cliente:", error);
      setMensaje("Error al guardar el cliente.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (cliente) => {
    setSelectedClient(cliente);
    setNuevoCliente(cliente);
    setPhotoPreview(cliente.foto_url);
  };

  const handleCancelarEdicion = () => {
    setSelectedClient(null);
    setNuevoCliente({
      perro_nombre: "",
      telefono: "",
      dueño_nombre: "",
      observaciones: "",
      patio: false,
      fugista: false,
      miedoso: false,
      microxip: "",
      foto_url: "",
    });
    setClientPhotoFile(null);
    setPhotoPreview(null);
  };

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Gestión de Clientes</h1>

      {mensaje && (
        <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded">
          {mensaje}
        </div>
      )}

      <form onSubmit={handleBuscar} className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono"
          value={filtro}
          onChange={handleFiltroChange}
          className="flex-1 p-2 border border-gray-300 rounded"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded"
          disabled={loading}
        >
          Buscar
        </button>
      </form>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-2">
          {selectedClient ? "Editar Cliente" : "Nuevo Cliente"}
        </h2>

        <div className="space-y-2">
          <input
            type="text"
            name="perro_nombre"
            placeholder="Nombre del perro"
            value={nuevoCliente.perro_nombre}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            name="dueño_nombre"
            placeholder="Dueño"
            value={nuevoCliente.dueño_nombre}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          />
          <input
            type="number"
            name="telefono"
            placeholder="Teléfono"
            value={nuevoCliente.telefono}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            name="microxip"
            placeholder="Microchip"
            value={nuevoCliente.microxip}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          />
          <textarea
            name="observaciones"
            placeholder="Observaciones"
            value={nuevoCliente.observaciones}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          />
          <div className="flex gap-4">
            <label>
              <input
                type="checkbox"
                name="patio"
                checked={nuevoCliente.patio}
                onChange={handleInputChange}
              />{" "}
              Patio
            </label>
            <label>
              <input
                type="checkbox"
                name="fugista"
                checked={nuevoCliente.fugista}
                onChange={handleInputChange}
              />{" "}
              Fugista
            </label>
            <label>
              <input
                type="checkbox"
                name="miedoso"
                checked={nuevoCliente.miedoso}
                onChange={handleInputChange}
              />{" "}
              Miedoso
            </label>
          </div>
          <input type="file" accept="image/*" onChange={handleFileChange} />
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Preview"
              className="w-24 h-24 object-cover rounded mt-2"
            />
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleGuardarCliente}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            {selectedClient ? "Guardar Cambios" : "Crear Cliente"}
          </button>
          {selectedClient && (
            <button
              onClick={handleCancelarEdicion}
              className="bg-gray-400 text-white px-4 py-2 rounded"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {clientes.map((cliente) => (
          <div
            key={cliente.id}
            className="flex items-center justify-between bg-white p-4 rounded shadow"
          >
            <div className="flex items-center gap-4">
              {cliente.foto_url ? (
                <img
                  src={cliente.foto_url}
                  alt={cliente.perro_nombre}
                  className="w-12 h-12 object-cover rounded-full"
                />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center bg-gray-200 rounded-full text-sm text-gray-500">
                  Sin foto
                </div>
              )}
              <div>
                <div className="font-semibold">{cliente.perro_nombre}</div>
                <div className="text-sm text-gray-600">
                  Dueño: {cliente.dueño_nombre}
                </div>
                <div className="text-sm text-gray-500">
                  📞 {cliente.telefono}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleEditar(cliente)}
              className="bg-violet-600 text-white px-3 py-1 rounded text-sm"
            >
              Editar
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-6">
        <button
          onClick={() => cargarClientes("prev")}
          disabled={firstDocStack.length <= 1}
          className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          onClick={() => cargarClientes("next")}
          disabled={!lastVisibleDoc || clientes.length < CLIENTES_POR_PAGINA}
          className="px-3 py-1 bg-gray-300 rounded"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default GestionClientesScreen;
