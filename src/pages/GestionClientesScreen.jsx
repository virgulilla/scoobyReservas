import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase/config";
import {
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  query,
  getDocs,
  limit,
  startAfter,
  orderBy,
  onSnapshot,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";

// Componente para mostrar los detalles de un cliente y permitir su edición
const ClientDetails = ({ client, onBack }) => {
  // Estados para los datos editables del cliente
  const [editedClient, setEditedClient] = useState(client);
  const [reservations, setReservations] = useState([]);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // useEffect para obtener las reservas del cliente
  useEffect(() => {
    if (!db || !client?.id) return;

    setLoadingReservations(true);

    const reservationsCollectionRef = collection(db, "reservations");
    const q = query(
      reservationsCollectionRef,
      where("id_cliente", "==", client.id)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reservationsData = [];
      querySnapshot.forEach((doc) => {
        reservationsData.push({ id: doc.id, ...doc.data() });
      });
      setReservations(reservationsData);
      setLoadingReservations(false);
    });

    return () => unsubscribe();
  }, [client?.id]);

  // Manejador de cambios en los campos de entrada
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditedClient((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Guardar los cambios del cliente en Firestore
  const handleSaveChanges = async () => {
    if (!db || !editedClient.id) return;
    setSaving(true);
    try {
      const clientRef = doc(db, "clients", editedClient.id);
      await updateDoc(clientRef, editedClient);
      setIsEditing(false);
      alert("Cambios guardados exitosamente."); // Usar un modal personalizado en un entorno de producción
    } catch (e) {
      console.error("Error al guardar los cambios: ", e);
      alert("Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  // Renderizar los valores booleanos
  const renderBooleanValue = (value) => {
    return value ? (
      <span className="text-green-600 font-semibold">Sí</span>
    ) : (
      <span className="text-red-600 font-semibold">No</span>
    );
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg">
      <button
        onClick={onBack}
        className="flex items-center text-blue-500 hover:text-blue-700 transition-colors mb-4"
      >
        {/* Icono de flecha izquierda (ArrowLeft) en SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Volver a la lista de clientes
      </button>

      <div className="flex justify-end mb-4">
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center bg-yellow-500 text-white py-2 px-4 rounded-full font-semibold hover:bg-yellow-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
            Editar
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={handleSaveChanges}
              disabled={saving}
              className={`flex items-center bg-green-500 text-white py-2 px-4 rounded-full font-semibold transition-colors ${
                saving
                  ? "bg-green-400 cursor-not-allowed"
                  : "hover:bg-green-600"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center bg-gray-300 text-gray-800 py-2 px-4 rounded-full font-semibold hover:bg-gray-400 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Cancelar
            </button>
          </div>
        )}
      </div>

      {editedClient.foto_url && (
        <div className="mb-4 flex justify-center">
          <img
            src={editedClient.foto_url}
            alt={`Foto de ${editedClient.perro_nombre}`}
            className="w-32 h-32 object-cover rounded-full shadow-md"
            onError={(e) => {
              e.target.onerror = null; // Evita bucles infinitos
              e.target.src =
                "https://placehold.co/128x128/e2e8f0/64748b?text=Foto";
            }}
          />
        </div>
      )}

      {/* Campos editables del cliente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 p-3 rounded-lg">
          <label className="text-gray-500 text-sm">Dueño</label>
          <input
            type="text"
            name="dueño_nombre"
            value={editedClient.dueño_nombre || ""}
            onChange={handleChange}
            readOnly={!isEditing}
            className={`w-full bg-transparent font-bold text-lg text-gray-800 focus:outline-none ${
              isEditing ? "border-b border-blue-500" : ""
            }`}
          />
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <label className="text-gray-500 text-sm">Perro</label>
          <input
            type="text"
            name="perro_nombre"
            value={editedClient.perro_nombre || ""}
            onChange={handleChange}
            readOnly={!isEditing}
            className={`w-full bg-transparent font-bold text-lg text-gray-800 focus:outline-none ${
              isEditing ? "border-b border-blue-500" : ""
            }`}
          />
        </div>
      </div>

      {/* Información de contacto */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 p-3 rounded-lg">
          <label className="text-gray-500 text-sm">Teléfono</label>
          <div className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-500 mr-3"
            >
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72v3.31a2 2 0 01-.28 1.48l-1.46 2.05a2 2 0 00.93 2.51l2.42 1.41a8 8 0 004.28 0l2.42-1.41a2 2 0 00.93-2.51l-1.46-2.05a2 2 0 01-.28-1.48V4.72a2 2 0 011.69-2.17h3a2 2 0 012 2v3z" />
            </svg>
            <input
              type="tel"
              name="telefono"
              value={editedClient.telefono || ""}
              onChange={handleChange}
              readOnly={!isEditing}
              className={`w-full bg-transparent text-gray-800 focus:outline-none ${
                isEditing ? "border-b border-blue-500" : ""
              }`}
            />
          </div>
        </div>
      </div>

      {/* Información adicional y checkboxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 p-3 rounded-lg flex items-center">
          {/* Icono de microchip en SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-500 mr-3"
          >
            <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
            <path d="M7 7h10v10H7z"></path>
            <path d="M12 2v2"></path>
            <path d="M12 20v2"></path>
            <path d="M2 12h2"></path>
            <path d="M20 12h2"></path>
            <path d="M16 4h4v4"></path>
            <path d="M16 20h4v-4"></path>
            <path d="M4 16v4h4"></path>
            <path d="M4 4h4v4"></path>
          </svg>
          <label htmlFor="microxip" className="text-gray-500 mr-2">
            Microchip:
          </label>
          <input
            type="text"
            id="microxip"
            name="microxip"
            value={editedClient.microxip || ""}
            onChange={handleChange}
            readOnly={!isEditing}
            className={`w-full bg-transparent text-gray-800 focus:outline-none ${
              isEditing ? "border-b border-blue-500" : ""
            }`}
          />
        </div>
        {/* Checkboxes para miedoso, fugista y patio */}
        <div className="flex flex-col space-y-2">
          <div className="bg-gray-50 p-3 rounded-lg flex items-center">
            <input
              type="checkbox"
              id="miedoso"
              name="miedoso"
              checked={editedClient.miedoso || false}
              onChange={handleChange}
              disabled={!isEditing}
              className="mr-3 w-5 h-5 accent-red-500"
            />
            <label htmlFor="miedoso" className="text-gray-700 font-semibold">
              Miedoso
            </label>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg flex items-center">
            <input
              type="checkbox"
              id="fugista"
              name="fugista"
              checked={editedClient.fugista || false}
              onChange={handleChange}
              disabled={!isEditing}
              className="mr-3 w-5 h-5 accent-yellow-500"
            />
            <label htmlFor="fugista" className="text-gray-700 font-semibold">
              Fugista
            </label>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg flex items-center">
            <input
              type="checkbox"
              id="patio"
              name="patio"
              checked={editedClient.patio || false}
              onChange={handleChange}
              disabled={!isEditing}
              className="mr-3 w-5 h-5 accent-green-500"
            />
            <label htmlFor="patio" className="text-gray-700 font-semibold">
              Patio
            </label>
          </div>
        </div>
      </div>

      {/* Sección de observaciones */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-700 flex items-center mb-2">
          {/* Icono de maletín (Briefcase) en SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 text-blue-600"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
          </svg>
          Observaciones
        </h3>
        <textarea
          name="observaciones"
          value={editedClient.observaciones || ""}
          onChange={handleChange}
          readOnly={!isEditing}
          className={`w-full p-3 bg-gray-50 rounded-lg focus:outline-none ${
            isEditing ? "border border-blue-500" : ""
          }`}
          rows="4"
        />
      </div>

      {/* Sección del historial de reservas */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-700 flex items-center mb-2">
          {/* Icono de calendario (Calendar) en SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 text-purple-600"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="M9 16l2 2 4-4" />
          </svg>
          Historial de Reservas
        </h3>
        {loadingReservations ? (
          <p className="text-gray-500 p-3 bg-gray-50 rounded-lg">
            Cargando reservas...
          </p>
        ) : reservations.length > 0 ? (
          <ul className="space-y-4">
            {reservations.map((res) => (
              <li
                key={res.id}
                className={`p-4 rounded-lg shadow-sm ${
                  res.is_cancelada
                    ? "bg-red-100 border-l-4 border-red-500"
                    : "bg-purple-50 border-l-4 border-purple-500"
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-lg font-bold text-gray-800">
                    Reserva para {res.perro_nombre || "perro no especificado"}
                  </h4>
                  {res.is_cancelada && (
                    <span className="text-sm font-semibold text-red-600">
                      CANCELADA
                    </span>
                  )}
                </div>
                <div
                  className={`grid grid-cols-1 md:grid-cols-2 gap-2 text-sm ${
                    res.is_cancelada ? "line-through text-gray-500" : ""
                  }`}
                >
                  <p>
                    <span className="font-semibold">Entrada:</span>{" "}
                    {res.fecha_entrada || "No especificada"}
                  </p>
                  <p>
                    <span className="font-semibold">Salida:</span>{" "}
                    {res.fecha_salida || "No especificada"}
                  </p>
                  <p>
                    <span className="font-semibold">Nº Perros:</span>{" "}
                    {res.num_perros || 0}
                  </p>
                  <p>
                    <span className="font-semibold">Total:</span>{" "}
                    {res.total_pago ? `$${res.total_pago}` : "No especificado"}
                  </p>
                  <p>
                    <span className="font-semibold">Anticipo:</span>{" "}
                    {res.pago_anticipado
                      ? `$${res.pago_anticipado}`
                      : "No especificado"}
                  </p>
                </div>
                {res.is_cancelada && res.motivo_cancelacion && (
                  <div className="mt-2 text-red-700 italic">
                    <span className="font-semibold">
                      Motivo de cancelación:
                    </span>{" "}
                    {res.motivo_cancelacion}
                  </div>
                )}
                {(res.observaciones || res.descripcion) && (
                  <div className="mt-2 text-gray-600">
                    <span className="font-semibold">Observaciones:</span>{" "}
                    {res.observaciones || res.descripcion}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 flex items-center p-3 bg-gray-50 rounded-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2 text-yellow-500"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12" y2="16" />
            </svg>
            No hay reservas registradas para este cliente.
          </p>
        )}
      </div>
    </div>
  );
};

const GestionClientesScreen = () => {
  // Estado para almacenar la lista de clientes
  const [clients, setClients] = useState([]);
  // Estado para el término de búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  // Estado para el cliente seleccionado
  const [selectedClient, setSelectedClient] = useState(null);
  // Estados para la carga de datos y errores
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Estado para el ID del usuario
  const [userId, setUserId] = useState(null);

  // Estados para la paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [clientsPerPage] = useState(5); // Número fijo de clientes por página
  const [lastVisible, setLastVisible] = useState(null);
  const [totalPages, setTotalPages] = useState(0);

  // useEffect para manejar la autenticación
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        try {
          const initialAuthToken =
            typeof __initial_auth_token !== "undefined"
              ? __initial_auth_token
              : null;
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        } catch (e) {
          console.error("Error signing in:", e);
          setError("No se pudo iniciar sesión en la base de datos.");
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Función asíncrona para obtener los clientes de Firestore
  const fetchClients = async (page) => {
    if (!db || !userId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const clientsCollectionRef = collection(db, "clients");

      const allDocsSnapshot = await getDocs(clientsCollectionRef);
      setTotalPages(Math.ceil(allDocsSnapshot.size / clientsPerPage));

      let clientsQuery;
      if (page === 1) {
        clientsQuery = query(
          clientsCollectionRef,
          orderBy("perro_nombre"),
          limit(clientsPerPage)
        );
      } else {
        clientsQuery = query(
          clientsCollectionRef,
          orderBy("perro_nombre"),
          startAfter(lastVisible),
          limit(clientsPerPage)
        );
      }

      const querySnapshot = await getDocs(clientsQuery);
      const clientsData = [];
      querySnapshot.forEach((doc) => {
        clientsData.push({ id: doc.id, ...doc.data() });
      });

      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setClients(clientsData);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Error al cargar los clientes.");
      setLoading(false);
    }
  };

  // useEffect para invocar la función de carga de clientes cuando cambia la página o el usuario
  useEffect(() => {
    if (userId) {
      fetchClients(currentPage);
    }
  }, [userId, currentPage]);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prevPage) => prevPage - 1);
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.perro_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.dueño_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateClient = () => {
    console.log("Crear nuevo cliente");
  };

  return (
    <div className="bg-gray-100 min-h-screen p-6">
      {selectedClient ? (
        <ClientDetails
          client={selectedClient}
          onBack={() => setSelectedClient(null)}
        />
      ) : (
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Gestión de Clientes
          </h1>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
            <div className="relative w-full sm:w-2/3">
              <input
                type="text"
                placeholder="Buscar clientes por nombre o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <button
              onClick={handleCreateClient}
              className="flex items-center bg-blue-600 text-white py-2 px-6 rounded-full font-semibold hover:bg-blue-700 transition-colors shadow-lg transform hover:scale-105"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Crear cliente
            </button>
          </div>
          <div className="space-y-4">
            {loading && (
              <p className="text-center text-gray-500 p-4 bg-gray-50 rounded-lg">
                Cargando clientes...
              </p>
            )}
            {error && (
              <p className="text-center text-red-500 p-4 bg-red-50 rounded-lg">
                {error}
              </p>
            )}
            {!loading && !error && filteredClients.length > 0
              ? filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="p-4 bg-gray-50 rounded-lg shadow-sm cursor-pointer hover:bg-gray-100 transition-all transform hover:scale-105"
                    onClick={() => setSelectedClient(client)}
                  >
                    <h3 className="text-lg font-semibold text-blue-600">
                      {client.perro_nombre}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      Dueño: {client.dueño_nombre}
                    </p>
                  </div>
                ))
              : !loading &&
                !error && (
                  <p className="text-center text-gray-500 p-4 bg-gray-50 rounded-lg">
                    No se encontraron clientes.
                  </p>
                )}
          </div>
          <hr className="my-6 border-gray-200" />
          <div className="flex justify-center items-center my-6 space-x-4">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className={`py-2 px-4 rounded-full font-semibold transition-colors ${
                currentPage === 1
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              Anterior
            </button>
            <span className="text-gray-700 font-semibold">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages || totalPages === 0}
              className={`py-2 px-4 rounded-full font-semibold transition-colors ${
                currentPage === totalPages || totalPages === 0
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionClientesScreen;
