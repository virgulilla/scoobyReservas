// Comentario: Gestión de clientes con panel de Historial (JS puro)
import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  where, // Comentario: necesario para historial por id_cliente
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
const HISTORIAL_POR_PAGINA = 10;

const GestionClientesScreen = () => {
  // Comentario: refs para scroll/enfoque del formulario
  const formRef = useRef(null);
  const firstInputRef = useRef(null);

  // Comentario: estado principal
  const [clientes, setClientes] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // Comentario: paginación de clientes
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState(null);
  const [firstDocStack, setFirstDocStack] = useState([]);

  // Comentario: edición/creación
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
  const [modalFoto, setModalFoto] = useState(null);

  // ------------------------------------------------------------
  // Comentario: estado del panel de historial
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyIncludeCanceled, setHistoryIncludeCanceled] = useState(false);
  const [historyLastDoc, setHistoryLastDoc] = useState(null);
  const [historyFirstDoc, setHistoryFirstDoc] = useState(null);
  const [historyStack, setHistoryStack] = useState([]);
  // ------------------------------------------------------------

  // Comentario: carga/paginación de clientes
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
        finalQuery = query(
          baseQuery,
          startAfter(lastVisibleDoc),
          limit(CLIENTES_POR_PAGINA)
        );
      } else if (direction === "prev" && firstVisibleDoc) {
        finalQuery = query(
          baseQuery,
          endBefore(firstVisibleDoc),
          limitToLast(CLIENTES_POR_PAGINA)
        );
      } else {
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

      if (direction === "next") {
        if (firstDoc) setFirstDocStack((prev) => [...prev, firstDoc]);
      } else if (direction === "prev") {
        setFirstDocStack((prev) =>
          prev.length > 1 ? prev.slice(0, -1) : prev
        );
      } else {
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

  // Comentario: búsqueda
  const handleFiltroChange = (e) => setFiltro(e.target.value);
  const handleBuscar = (e) => {
    e.preventDefault();
    setLastVisibleDoc(null);
    setFirstVisibleDoc(null);
    setFirstDocStack([]);
    cargarClientes("reset");
  };

  // Comentario: formulario
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
    // Comentario: subir imagen a Cloudinary
    const cloudName = "denlgwyus";
    const uploadPreset = "mis-mascotas";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: formData }
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
        // Comentario: normalizar nombre para ordenación/búsqueda por prefijo
        perro_nombre: (nuevoCliente.perro_nombre || "").toLowerCase(),
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

    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => {
      if (firstInputRef.current) firstInputRef.current.focus();
    }, 250);
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

  // ------------------------------------------------------------
  // Comentario: Historial — abrir/cerrar y cargar con paginación
  const handleVerHistorial = (cliente) => {
    setHistoryClient(cliente);
    setHistoryIncludeCanceled(false);
    setHistoryOpen(true);
    setHistoryItems([]);
    setHistoryFirstDoc(null);
    setHistoryLastDoc(null);
    setHistoryStack([]);
    cargarHistorial(cliente, "reset");
  };

  const handleCerrarHistorial = () => {
    setHistoryOpen(false);
    setHistoryClient(null);
    setHistoryItems([]);
  };

  const cargarHistorial = async (cliente, direction = "reset") => {
    if (!cliente?.id) return;
    setHistoryLoading(true);
    try {
      const reservasRef = collection(db, "reservations");

      // Comentario: historial por cliente, ordenado por fecha_entrada DESC
      let baseQuery = query(
        reservasRef,
        where("id_cliente", "==", cliente.id),
        orderBy("fecha_entrada", "desc")
      );

      let finalQuery;
      if (direction === "next" && historyLastDoc) {
        finalQuery = query(
          baseQuery,
          startAfter(historyLastDoc),
          limit(HISTORIAL_POR_PAGINA)
        );
      } else if (direction === "prev" && historyFirstDoc) {
        finalQuery = query(
          baseQuery,
          endBefore(historyFirstDoc),
          limitToLast(HISTORIAL_POR_PAGINA)
        );
      } else {
        finalQuery = query(baseQuery, limit(HISTORIAL_POR_PAGINA));
      }

      const snap = await getDocs(finalQuery);
      console.log(snap);
      let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Comentario: filtrar canceladas si el toggle está OFF
      if (!historyIncludeCanceled) {
        items = items.filter((x) => !x.is_cancelada);
      }

      setHistoryItems(items);

      const first = snap.docs[0] ?? null;
      const last = snap.docs[snap.docs.length - 1] ?? null;
      setHistoryFirstDoc(first);
      setHistoryLastDoc(last);

      if (direction === "next") {
        if (first) setHistoryStack((prev) => [...prev, first]);
      } else if (direction === "prev") {
        setHistoryStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
      } else {
        setHistoryStack(first ? [first] : []);
      }
    } catch (e) {
      console.error("Error al cargar historial:", e);
    } finally {
      setHistoryLoading(false);
    }
  };
  // ------------------------------------------------------------
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

      <div ref={formRef} className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-2">
          {selectedClient ? "Editar Cliente" : "Nuevo Cliente"}
        </h2>

        <div className="space-y-2">
          <input
            ref={firstInputRef}
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
                  onClick={() => setModalFoto(cliente.foto_url)}
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleVerHistorial(cliente)}
                className="bg-amber-600 text-white px-3 py-1 rounded text-sm"
              >
                Historial
              </button>
              <button
                onClick={() => handleEditar(cliente)}
                className="bg-violet-600 text-white px-3 py-1 rounded text-sm"
              >
                Editar
              </button>
            </div>
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

      {/* -------------------------------------------------------- */}
      {/* Comentario: Drawer de Historial */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={handleCerrarHistorial}
            aria-hidden
          />
          <div className="w-full max-w-md bg-white h-full shadow-xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                Historial · {historyClient?.perro_nombre}
              </h3>
              <button
                onClick={handleCerrarHistorial}
                className="text-gray-600 hover:text-gray-900"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between mb-3">
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={historyIncludeCanceled}
                  onChange={(e) => {
                    setHistoryIncludeCanceled(e.target.checked);
                    // Comentario: recargar desde el inicio al cambiar el filtro
                    if (historyClient) cargarHistorial(historyClient, "reset");
                  }}
                />
                Incluir canceladas
              </label>
            </div>

            {historyLoading ? (
              <p className="text-sm text-gray-500">Cargando...</p>
            ) : historyItems.length === 0 ? (
              <p className="text-sm text-gray-500">Sin registros.</p>
            ) : (
              <ul className="space-y-2">
                {historyItems.map((r) => {
                  const esCancelada = r.is_cancelada === true;
                  return (
                    <li
                      key={r.id}
                      className={`p-3 rounded border ${
                        esCancelada
                          ? "bg-red-50 border-red-200"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">
                            {r.fecha_entrada} → {r.fecha_salida}
                          </p>
                          <p className="text-sm text-gray-600">
                            {r.num_perros || 1} perro(s)
                            {r.telefono ? ` · ${r.telefono}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          {esCancelada && (
                            <span className="inline-block text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-300">
                              Cancelada
                            </span>
                          )}
                          {!esCancelada && r.total_pago != null && (
                            <p className="text-sm font-semibold">
                              {r.total_pago} €
                            </p>
                          )}
                          <a
                            href={`/editar-reserva/${r.id}`}
                            className="mt-2 inline-block text-xs text-indigo-700 hover:underline"
                          >
                            Ver/Editar
                          </a>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => cargarHistorial(historyClient, "prev")}
                disabled={historyStack.length <= 1 || historyLoading}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => cargarHistorial(historyClient, "next")}
                disabled={
                  !historyLastDoc ||
                  historyItems.length < HISTORIAL_POR_PAGINA ||
                  historyLoading
                }
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
      {modalFoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setModalFoto(null)}
        >
          <img
            src={modalFoto}
            alt="Foto ampliada"
            className="max-w-full max-h-full rounded-lg shadow-lg"
            onClick={(e) => e.stopPropagation()} // evita cerrar si se hace clic sobre la imagen
          />
        </div>
      )}
    </div>
  );
};

export default GestionClientesScreen;
