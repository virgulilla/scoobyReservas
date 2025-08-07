import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../firebase/config"; // Asegúrate de que 'auth' está exportado desde tu configuración de firebase
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  startAt,
  endAt,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth"; // Importa la función de autenticación
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

// Constante para la larga estancia
const DIAS_LARGA_ESTANCIA = 30; // Primeras 30 noches a precio normal

const NuevaReservaScreen = () => {
  const navigate = useNavigate();
  // Obtiene el bookingId de los parámetros de la URL
  const { bookingId } = useParams();

  // Nuevo estado para el rol del usuario
  const [userRole, setUserRole] = useState(null);

  // Estados para la búsqueda y selección del cliente
  const [searchQuery, setSearchQuery] = useState({
    perro_nombre: "",
    telefono: "",
  });
  const [searchResults, setSearchResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({
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
  const [clientPhotoFile, setClientPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Estados del formulario de reserva
  const [dateRange, setDateRange] = useState([null, null]);
  const [form, setForm] = useState({
    perro_nombre: "",
    telefono: "",
    fecha_entrada: "",
    fecha_salida: "",
    num_perros: 1,
    total_pago: 0,
    pago_anticipado: 0,
    descripcion: "",
  });

  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState(null);
  const [message, setMessage] = useState("");

  // Nuevos estados para la funcionalidad de cancelar
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  // Lógica para calcular el precio de la reserva (código original del usuario)
  const calculatePrice = (startDate, endDate, numPerros) => {
    if (
      !prices ||
      !startDate ||
      !endDate ||
      numPerros < 1 ||
      startDate > endDate
    ) {
      return 0;
    }

    const normalizedStartDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    );
    const normalizedEndDate = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate()
    );
    const diffTime = Math.abs(
      normalizedEndDate.getTime() - normalizedStartDate.getTime()
    );
    const numNoches = diffTime / (1000 * 60 * 60 * 24);

    if (numNoches === 0) {
      let price = prices.precio_estancia_un_dia;
      if (numPerros > 1) {
        price +=
          prices.descuento_perro_adicional *
          (numPerros - 1) *
          prices.precio_estancia_un_dia;
      }
      return price;
    }

    let precioTotal = 0;

    if (numNoches === 1) {
      precioTotal = prices.precio_una_noche;
      if (numPerros > 1) {
        precioTotal +=
          prices.descuento_perro_adicional *
          (numPerros - 1) *
          prices.precio_una_noche;
      }
      return precioTotal;
    }

    for (let i = 0; i < numNoches; i++) {
      const fechaActual = new Date(normalizedStartDate);
      fechaActual.setDate(normalizedStartDate.getDate() + i);

      let precioPorNochePrimerPerro = 0;
      const mesActual = fechaActual.getMonth(); // 0 = Enero, 7 = Agosto

      if (mesActual === 7) {
        precioPorNochePrimerPerro = prices.precio_agosto;
        precioTotal += precioPorNochePrimerPerro * numPerros;
      } else if (i >= DIAS_LARGA_ESTANCIA) {
        precioPorNochePrimerPerro = prices.precio_larga_estancia;
        let precioPorNocheConDescuento = 0;
        if (numPerros > 1) {
          const precioPerroAdicional =
            precioPorNochePrimerPerro * (1 - prices.descuento_perro_adicional);
          precioPorNocheConDescuento =
            precioPorNochePrimerPerro + precioPerroAdicional * (numPerros - 1);
        } else {
          precioPorNocheConDescuento = precioPorNochePrimerPerro;
        }
        precioTotal += precioPorNocheConDescuento;
      } else {
        precioPorNochePrimerPerro = prices.precio_dia_adulto;
        let precioPorNocheConDescuento = 0;
        if (numPerros > 1) {
          const precioPerroAdicional =
            precioPorNochePrimerPerro * (1 - prices.descuento_perro_adicional);
          precioPorNocheConDescuento =
            precioPorNochePrimerPerro + precioPerroAdicional * (numPerros - 1);
        } else {
          precioPorNocheConDescuento = precioPorNochePrimerPerro;
        }
        precioTotal += precioPorNocheConDescuento;
      }
    }

    return precioTotal > 0 ? precioTotal : 0;
  };

  // ----------------------------------------------------
  // NUEVA LÓGICA DE AUTENTICACIÓN Y ROLES
  // ----------------------------------------------------
  useEffect(() => {
    // Escucha los cambios en el estado de autenticación de Firebase
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Si hay un usuario logueado, obtén su rol de la colección 'userRoles'
        const userRoleDocRef = doc(db, "users", user.uid);
        const userRoleDocSnap = await getDoc(userRoleDocRef);

        if (userRoleDocSnap.exists()) {
          setUserRole(userRoleDocSnap.data().role);
        } else {
          // Si el usuario no tiene un rol definido, asigna 'user' por defecto
          setUserRole("user");
          console.log(
            "No se encontró el rol para el usuario. Rol asignado: 'user'."
          );
        }
      } else {
        // No hay usuario logueado
        setUserRole(null);
      }
    });

    // Limpia el listener cuando el componente se desmonta
    return () => unsubscribe();
  }, []);
  // ----------------------------------------------------

  // Efecto para cargar los precios de Firestore y la reserva si es para editar
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Cargar los precios primero
      const pricesDocRef = doc(db, "prices", "tarifas2");
      const pricesDocSnap = await getDoc(pricesDocRef);
      if (pricesDocSnap.exists()) {
        setPrices(pricesDocSnap.data());
      } else {
        console.error("Documento de precios 'tarifas2' no encontrado.");
        setMessage(
          "Error: No se pudieron cargar las tarifas de precios. Por favor, configura el documento 'tarifas2' en Firestore."
        );
        setLoading(false);
        return;
      }

      // Si existe un bookingId, cargar los datos de la reserva y el cliente
      if (bookingId) {
        try {
          const bookingDocRef = doc(db, "reservations", bookingId);
          const bookingDocSnap = await getDoc(bookingDocRef);

          if (bookingDocSnap.exists()) {
            const bookingData = bookingDocSnap.data();

            // Cargar el cliente asociado a la reserva
            const clientDocRef = doc(db, "clients", bookingData.id_cliente);
            const clientDocSnap = await getDoc(clientDocRef);

            if (clientDocSnap.exists()) {
              const clientData = clientDocSnap.data();
              setSelectedClient({
                id: clientDocSnap.id,
                ...clientData,
              });
            } else {
              setMessage("Error: Cliente asociado a la reserva no encontrado.");
            }

            // Setear los datos del formulario con la información de la reserva
            setForm({
              perro_nombre: bookingData.perro_nombre,
              telefono: bookingData.telefono,
              num_perros: bookingData.num_perros,
              total_pago: bookingData.total_pago,
              pago_anticipado: bookingData.pago_anticipado,
              descripcion: bookingData.descripcion,
            });

            // Setear el rango de fechas
            setDateRange([
              new Date(bookingData.fecha_entrada),
              new Date(bookingData.fecha_salida),
            ]);

            // Cargar el motivo de la cancelación si la reserva está cancelada
            if (bookingData.is_cancelada) {
              setMessage("Esta reserva ha sido cancelada.");
              setCancellationReason(bookingData.motivo_cancelacion || "");
            } else {
              setMessage("Reserva cargada para editar.");
            }
          } else {
            setMessage("Error: Reserva no encontrada.");
            console.error("Reserva con ID", bookingId, "no encontrada.");
          }
        } catch (error) {
          console.error("Error al cargar la reserva:", error);
          setMessage("Ocurrió un error al cargar la reserva.");
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [bookingId]); // El efecto se ejecuta al cargar y cuando cambia el bookingId

  // Efecto para recalcular el precio total cuando cambian las fechas o el número de perros
  useEffect(() => {
    if (prices && dateRange[0] && dateRange[1]) {
      const precioCalculado = calculatePrice(
        dateRange[0],
        dateRange[1],
        form.num_perros
      );
      setForm((prevForm) => ({
        ...prevForm,
        total_pago: precioCalculado,
      }));
    }
  }, [dateRange, form.num_perros, prices]);

  // Maneja los cambios en los campos de búsqueda
  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchQuery({
      ...searchQuery,
      [name]: value,
    });
  };

  // Maneja la búsqueda de clientes en Firestore
  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSearchResults([]);
    setSelectedClient(null);
    setMessage("");

    const clientsCollectionRef = collection(db, "clients");
    let clientQuery;

    if (searchQuery.perro_nombre) {
      const perroNombreLower = searchQuery.perro_nombre.toLowerCase();
      const endSearch =
        perroNombreLower.slice(0, -1) +
        String.fromCharCode(
          perroNombreLower.charCodeAt(perroNombreLower.length - 1) + 1
        );

      clientQuery = query(
        clientsCollectionRef,
        orderBy("perro_nombre"),
        startAt(perroNombreLower),
        endAt(endSearch)
      );
    } else if (searchQuery.telefono) {
      clientQuery = query(
        clientsCollectionRef,
        where("telefono", "==", searchQuery.telefono)
      );
    } else {
      setMessage(
        "Por favor, introduce el nombre del perro o el teléfono para buscar."
      );
      setLoading(false);
      return;
    }

    try {
      const querySnapshot = await getDocs(clientQuery);
      const clients = [];
      querySnapshot.forEach((doc) => {
        clients.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      setSearchResults(clients);
      setLoading(false);
      if (clients.length === 0) {
        setMessage(
          "No se encontraron clientes. Puedes crear uno nuevo si lo deseas."
        );
      }
    } catch (error) {
      console.error("Error searching for clients:", error);
      setMessage("Ocurrió un error al buscar clientes.");
      setLoading(false);
    }
  };

  // Selecciona un cliente de los resultados de búsqueda
  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setForm((prevForm) => ({
      ...prevForm,
      perro_nombre: client.perro_nombre,
      telefono: client.telefono,
      descripcion: "", // Limpiar la descripción de la reserva
    }));
    setSearchResults([]);
    setMessage("");
  };

  // Maneja el cambio de la foto y crea una vista previa
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setClientPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Sube la foto a Cloudinary y devuelve la URL de descarga
  const uploadPhotoToCloudinary = async (file) => {
    const cloudName = "denlgwyus";
    const uploadPreset = "mis-mascotas";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error("Error uploading to Cloudinary:", error);
      throw new Error("Error al subir la foto a Cloudinary.");
    }
  };

  // Maneja la creación de un nuevo cliente
  const handleCreateClient = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    let photoURL = "";
    if (clientPhotoFile) {
      try {
        setMessage("Subiendo foto a Cloudinary...");
        photoURL = await uploadPhotoToCloudinary(clientPhotoFile);
      } catch (error) {
        console.error("Error uploading photo:", error);
        setMessage("Error al subir la foto. Cliente no guardado.");
        setLoading(false);
        return;
      }
    }

    try {
      const docRef = await addDoc(collection(db, "clients"), {
        ...newClientData,
        foto_url: photoURL,
      });
      const newClient = {
        ...newClientData,
        id: docRef.id,
        foto_url: photoURL,
      };
      setSelectedClient(newClient);
      setForm((prevForm) => ({
        ...prevForm,
        perro_nombre: newClient.perro_nombre,
        telefono: newClient.telefono,
        descripcion: "",
      }));
      setShowClientForm(false);
      setNewClientData({
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
      setMessage("Cliente creado con éxito.");
    } catch (error) {
      console.error("Error creating new client:", error);
      setMessage("Ocurrió un error al crear el cliente.");
    }
    setLoading(false);
  };

  // Maneja cambios en el formulario de reserva (num_perros, pago_anticipado, etc.)
  const handleChange = (e) => {
    // Solo permite cambios si el rol es 'admin'
    if (userRole !== "admin" && bookingId) {
      setMessage("No tienes permisos para editar esta reserva.");
      return;
    }
    const { name, value } = e.target;
    setForm((prevForm) => ({
      ...prevForm,
      [name]:
        name === "num_perros" ||
        name === "total_pago" ||
        name === "pago_anticipado"
          ? Number(value)
          : value,
    }));
  };

  // Maneja el cambio del calendario
  const handleCalendarChange = (newDateRange) => {
    // Solo permite cambios si el rol es 'admin'
    if (userRole !== "admin" && bookingId) {
      setMessage("No tienes permisos para editar esta reserva.");
      return;
    }
    if (newDateRange[0] && !newDateRange[1]) {
      setDateRange([newDateRange[0], newDateRange[0]]);
    } else {
      setDateRange(newDateRange);
    }
  };

  // Maneja el envío del formulario para crear/editar la reserva
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient || !dateRange[0] || !dateRange[1]) {
      setMessage("Por favor, selecciona un cliente y un rango de fechas.");
      return;
    }

    // Solo permite el envío si el rol es 'admin' para la edición
    if (userRole !== "admin" && bookingId) {
      setMessage("No tienes permisos para editar esta reserva.");
      return;
    }

    setLoading(true);
    try {
      const [fechaEntrada, fechaSalida] = dateRange;
      const añoEntrada = fechaEntrada.getFullYear();
      const mesEntrada = (fechaEntrada.getMonth() + 1)
        .toString()
        .padStart(2, "0");
      const diaEntrada = fechaEntrada.getDate().toString().padStart(2, "0");
      const fechaLocalEntrada = `${añoEntrada}-${mesEntrada}-${diaEntrada}`;
      const añoSalida = fechaSalida.getFullYear();
      const mesSalida = (fechaSalida.getMonth() + 1)
        .toString()
        .padStart(2, "0");
      const diaSalida = fechaSalida.getDate().toString().padStart(2, "0");
      const fechaLocalSalida = `${añoSalida}-${mesSalida}-${diaSalida}`;
      const formattedForm = {
        ...form,
        id_cliente: selectedClient.id,
        fecha_entrada: fechaLocalEntrada,
        fecha_salida: fechaLocalSalida,
        dueño_nombre: selectedClient.dueño_nombre,
        observaciones: selectedClient.observaciones,
        patio: selectedClient.patio,
        fugista: selectedClient.fugista,
        miedoso: selectedClient.miedoso,
        microxip: selectedClient.microxip,
        foto_url: selectedClient.foto_url,
      };

      if (bookingId) {
        // Lógica para actualizar una reserva existente
        const bookingDocRef = doc(db, "reservations", bookingId);
        await updateDoc(bookingDocRef, formattedForm); // Usar updateDoc para no sobrescribir todo
        console.log("Reserva actualizada con ID:", bookingId);
        setMessage("Reserva actualizada con éxito.");
      } else {
        // Lógica para crear una nueva reserva
        const docRef = await addDoc(collection(db, "reservations"), {
          ...formattedForm,
          is_cancelada: false, // Nueva reserva por defecto no está cancelada
          motivo_cancelacion: "",
        });
        console.log("Nueva reserva creada con ID:", docRef.id);
        setMessage("Reserva creada con éxito.");
      }

      navigate("/calendario");
    } catch (error) {
      console.error("Error al guardar la reserva:", error);
      setMessage("Ocurrió un error al guardar la reserva.");
      setLoading(false);
    }
  };

  // Función para mostrar la modal de cancelación
  const handleCancelBookingClick = () => {
    // Solo permite mostrar la modal si el rol es 'admin'
    if (userRole !== "admin") {
      setMessage("No tienes permisos para cancelar esta reserva.");
      return;
    }
    setShowCancelModal(true);
  };

  // Función para cerrar la modal de cancelación
  const handleCloseModal = () => {
    setShowCancelModal(false);
    setCancellationReason("");
  };

  // Función para confirmar la cancelación de la reserva
  const handleConfirmCancellation = async () => {
    if (!bookingId) return;

    // Solo permite la cancelación si el rol es 'admin'
    if (userRole !== "admin") {
      setMessage("No tienes permisos para cancelar esta reserva.");
      handleCloseModal();
      return;
    }

    setLoading(true);
    try {
      const bookingDocRef = doc(db, "reservations", bookingId);
      await updateDoc(bookingDocRef, {
        is_cancelada: true,
        motivo_cancelacion: cancellationReason,
      });

      console.log("Reserva cancelada con ID:", bookingId);
      setMessage("Reserva cancelada con éxito.");
      navigate("/calendario");
    } catch (error) {
      console.error("Error al cancelar la reserva:", error);
      setMessage("Ocurrió un error al cancelar la reserva.");
    } finally {
      setLoading(false);
      handleCloseModal();
    }
  };

  const commonInputClasses =
    "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500";
  const commonButtonClasses =
    "w-full px-4 py-2 font-bold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500";

  // Determina si los campos del formulario deben ser de solo lectura
  const isFormReadOnly = bookingId && userRole !== "admin";

  return (
    <div className="p-6 pb-16 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">
        {bookingId ? "Editar Reserva" : "Crear Nueva Reserva"}
      </h1>

      {message && (
        <div className="p-3 mb-4 text-center text-sm font-semibold text-white bg-indigo-500 rounded-md">
          {message}
        </div>
      )}

      {/* Formulario de búsqueda o creación de cliente */}
      {!selectedClient && !bookingId && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Paso 1: Buscar o Crear Cliente
          </h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre del Perro
              </label>
              <input
                type="text"
                name="perro_nombre"
                value={searchQuery.perro_nombre}
                onChange={handleSearchChange}
                className={commonInputClasses}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Teléfono
              </label>
              <input
                type="text"
                name="telefono"
                value={searchQuery.telefono}
                onChange={handleSearchChange}
                className={commonInputClasses}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={commonButtonClasses}
            >
              {loading ? "Buscando..." : "Buscar Cliente"}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <p className="text-gray-600 mb-2">Clientes encontrados:</p>
              {searchResults.map((client) => (
                <div
                  key={client.id}
                  onClick={() => handleSelectClient(client)}
                  className="p-3 mb-2 bg-gray-50 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <p className="font-semibold text-gray-800">
                    {client.perro_nombre}
                  </p>
                  <p className="text-sm text-gray-500">
                    Teléfono: {client.telefono}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!loading &&
            searchQuery.perro_nombre &&
            searchResults.length === 0 && (
              <div className="mt-6 text-center">
                <p className="text-gray-600 mb-2">
                  No se encontraron clientes. ¿Quieres crear uno nuevo?
                </p>
                <button
                  onClick={() => setShowClientForm(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Crear Nuevo Cliente
                </button>
              </div>
            )}

          {showClientForm && (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-lg font-semibold mb-2">
                Crear Nuevo Cliente
              </h3>
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre del Perro
                  </label>
                  <input
                    type="text"
                    name="perro_nombre"
                    value={newClientData.perro_nombre}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        perro_nombre: e.target.value,
                      })
                    }
                    className={commonInputClasses}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre del Dueño
                  </label>
                  <input
                    type="text"
                    name="dueño_nombre"
                    value={newClientData.dueño_nombre}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        dueño_nombre: e.target.value,
                      })
                    }
                    className={commonInputClasses}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    name="telefono"
                    value={newClientData.telefono}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        telefono: e.target.value,
                      })
                    }
                    className={commonInputClasses}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Foto del Perro
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {photoPreview && (
                    <div className="mt-2 w-32 h-32 overflow-hidden rounded-md border border-gray-300">
                      <img
                        src={photoPreview}
                        alt="Vista previa de la foto del perro"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Observaciones
                  </label>
                  <textarea
                    name="observaciones"
                    value={newClientData.observaciones}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        observaciones: e.target.value,
                      })
                    }
                    className={commonInputClasses}
                    rows="3"
                  ></textarea>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="patio"
                      checked={newClientData.patio}
                      onChange={(e) =>
                        setNewClientData({
                          ...newClientData,
                          patio: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm font-medium text-gray-700">
                      Patio
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="fugista"
                      checked={newClientData.fugista}
                      onChange={(e) =>
                        setNewClientData({
                          ...newClientData,
                          fugista: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm font-medium text-gray-700">
                      Fugista
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="miedoso"
                      checked={newClientData.miedoso}
                      onChange={(e) =>
                        setNewClientData({
                          ...newClientData,
                          miedoso: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm font-medium text-gray-700">
                      Miedoso
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Microchip
                  </label>
                  <input
                    type="text"
                    name="microxip"
                    value={newClientData.microxip}
                    onChange={(e) =>
                      setNewClientData({
                        ...newClientData,
                        microxip: e.target.value,
                      })
                    }
                    className={commonInputClasses}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={commonButtonClasses}
                >
                  {loading ? "Creando..." : "Guardar Cliente"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Formulario de reserva visible solo cuando un cliente está seleccionado */}
      {selectedClient && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Paso 2: Datos de la Reserva
          </h2>
          <div className="mb-4 p-3 bg-indigo-50 border-l-4 border-indigo-400 rounded-md flex flex-col items-center space-y-4">
            {selectedClient.foto_url && (
              <div className="w-20 h-20 overflow-hidden rounded-full border-2 border-indigo-400 flex-shrink-0">
                <img
                  src={selectedClient.foto_url}
                  alt={`Foto de ${selectedClient.perro_nombre}`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="w-full text-center">
              <p>
                <b>Perro:</b> {selectedClient.perro_nombre}
              </p>
              <p>
                <b>Dueño:</b> {selectedClient.dueño_nombre}
              </p>
              <p>
                <b>Teléfono:</b> {selectedClient.telefono}
              </p>
              <p>
                <b>Observaciones:</b> {selectedClient.observaciones}
              </p>
              <p>
                <b>Microchip:</b> {selectedClient.microxip}
              </p>
              <button
                onClick={() => setSelectedClient(null)}
                className="mt-2 text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Cambiar cliente
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-gray-700">Rango de Fechas</span>
              <Calendar
                onChange={handleCalendarChange}
                value={dateRange}
                selectRange={true}
                className="mt-1 w-full rounded-md shadow-sm"
                readOnly={isFormReadOnly}
              />
            </label>
            <label className="block">
              <span className="text-gray-700">Número de Perros</span>
              <input
                type="number"
                name="num_perros"
                value={form.num_perros}
                onChange={handleChange}
                className={commonInputClasses}
                min="1"
                required
                readOnly={isFormReadOnly}
              />
            </label>
            <label className="block">
              <span className="text-gray-700">Total a Pagar (€)</span>
              <input
                type="number"
                name="total_pago"
                value={form.total_pago}
                onChange={handleChange}
                className={commonInputClasses}
                required
              />
            </label>
            <label className="block">
              <span className="text-gray-700">Pago Anticipado (€)</span>
              <input
                type="number"
                name="pago_anticipado"
                value={form.pago_anticipado}
                onChange={handleChange}
                className={commonInputClasses}
                readOnly={isFormReadOnly}
              />
            </label>
            <label className="block">
              <span className="text-gray-700">Descripción</span>
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                rows="3"
                className={commonInputClasses}
                readOnly={isFormReadOnly}
              ></textarea>
            </label>

            {/* Renderiza el botón de guardar solo si es un nuevo formulario o si el rol es 'admin' */}
            {(!bookingId || userRole === "admin") && (
              <button
                type="submit"
                disabled={loading || isFormReadOnly}
                className={commonButtonClasses}
              >
                {loading
                  ? bookingId
                    ? "Guardando cambios..."
                    : "Creando Reserva..."
                  : bookingId
                  ? "Guardar Cambios"
                  : "Crear Reserva"}
              </button>
            )}
          </form>

          {/* Botón de Cancelar Reserva (visible solo en modo edición y para 'admin') */}
          {bookingId && userRole === "admin" && (
            <button
              onClick={handleCancelBookingClick}
              className="mt-4 w-full px-4 py-2 font-bold text-white bg-red-600 rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Cancelar Reserva
            </button>
          )}
        </div>
      )}

      {/* Modal para cancelar reserva */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Confirmar Cancelación
            </h2>
            <p className="mb-4 text-gray-700">
              ¿Estás seguro de que quieres cancelar esta reserva? Por favor,
              introduce un motivo.
            </p>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className={commonInputClasses + " mb-4"}
              placeholder="Motivo de la cancelación..."
              rows="3"
            ></textarea>
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cerrar
              </button>
              <button
                onClick={handleConfirmCancellation}
                disabled={loading || !cancellationReason}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Cancelando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NuevaReservaScreen;
