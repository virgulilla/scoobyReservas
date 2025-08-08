// Comentario: NuevaReservaScreen con buscador tipo MorososScreen (debounce), creación de cliente siempre visible,
// Comentario: cálculo de precio, roles, edición/creación, cancelación, Cloudinary upload.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, auth } from "../firebase/config";
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  startAt,
  endAt,
  getDocs,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

// Comentario: primeras 30 noches a tarifa normal
const DIAS_LARGA_ESTANCIA = 30;

const NuevaReservaScreen = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams();

  // -------- Roles / estado general ----------
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState(null);
  const [message, setMessage] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState(null);

  // -------- Buscador (adaptado de MorososScreen) ----------
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef(null);

  // -------- Cliente seleccionado / alta de cliente ----------
  const [selectedClient, setSelectedClient] = useState(null);
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

  // -------- Reserva ----------
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

  const [isPriceModifiedManually, setIsPriceModifiedManually] = useState(false);
  const [isLoadingBooking, setIsLoadingBooking] = useState(!!bookingId);
  const [hasUserTouchedForm, setHasUserTouchedForm] = useState(false);

  // -------- Cancelación ----------
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  // -------- Helpers UI ----------
  const commonInputClasses =
    "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500";
  const commonButtonClasses =
    "w-full px-4 py-2 font-bold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500";
  const isFormReadOnly = bookingId && userRole !== "admin";

  // =================== Auth / roles ===================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRoleDocRef = doc(db, "users", user.uid);
        const userRoleDocSnap = await getDoc(userRoleDocRef);
        setUserRole(
          userRoleDocSnap.exists() ? userRoleDocSnap.data().role : "user"
        );
      } else {
        setUserRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // =================== Precios + cargar reserva (edición) ===================
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Comentario: cargar precios
      const pricesDocRef = doc(db, "prices", "tarifas2");
      const pricesDocSnap = await getDoc(pricesDocRef);
      if (pricesDocSnap.exists()) {
        setPrices(pricesDocSnap.data());
      } else {
        setMessage(
          "Error: no se pudieron cargar las tarifas (prices/tarifas2)."
        );
        setLoading(false);
        return;
      }

      // Comentario: si es edición, cargar reserva + cliente
      if (bookingId) {
        setIsLoadingBooking(true);
        try {
          const bookingDocRef = doc(db, "reservations", bookingId);
          const bookingDocSnap = await getDoc(bookingDocRef);
          if (bookingDocSnap.exists()) {
            const bookingData = bookingDocSnap.data();
            // Comentario: cliente
            if (bookingData.id_cliente) {
              const clientDocRef = doc(db, "clients", bookingData.id_cliente);
              const clientDocSnap = await getDoc(clientDocRef);
              if (clientDocSnap.exists()) {
                setSelectedClient({
                  id: clientDocSnap.id,
                  ...clientDocSnap.data(),
                });
              } else {
                setMessage("Cliente de la reserva no encontrado.");
              }
            }

            // Comentario: form + fechas
            setForm({
              perro_nombre: bookingData.perro_nombre,
              telefono: bookingData.telefono,
              num_perros: bookingData.num_perros,
              total_pago: bookingData.total_pago,
              pago_anticipado: bookingData.pago_anticipado,
              descripcion: bookingData.descripcion,
            });
            setDateRange([
              new Date(bookingData.fecha_entrada),
              new Date(bookingData.fecha_salida),
            ]);

            if (bookingData.is_cancelada) {
              setMessage("Esta reserva ha sido cancelada.");
              setCancellationReason(bookingData.motivo_cancelacion || "");
            }
          } else {
            setMessage("Reserva no encontrada.");
          }
        } catch (err) {
          console.error("Error cargando reserva:", err);
          setMessage("Ocurrió un error al cargar la reserva.");
        } finally {
          setIsLoadingBooking(false);
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [bookingId]);

  // =================== Cálculo de precio ===================
  const calculatePrice = (startDate, endDate, numPerros) => {
    // Comentario: mismo algoritmo que tenías, respetando agosto y larga estancia
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

    if (numNoches === 1) {
      let precioTotal = prices.precio_una_noche;
      if (numPerros > 1) {
        precioTotal +=
          prices.descuento_perro_adicional *
          (numPerros - 1) *
          prices.precio_una_noche;
      }
      return precioTotal;
    }

    let precioTotal = 0;
    for (let i = 0; i < numNoches; i++) {
      const fechaActual = new Date(normalizedStartDate);
      fechaActual.setDate(normalizedStartDate.getDate() + i);

      const mesActual = fechaActual.getMonth(); // 7 = Agosto
      if (mesActual === 7) {
        precioTotal += prices.precio_agosto * numPerros;
        continue;
      }

      const base =
        i >= DIAS_LARGA_ESTANCIA
          ? prices.precio_larga_estancia
          : prices.precio_dia_adulto;

      if (numPerros === 1) {
        precioTotal += base;
      } else {
        const adicional = base * (1 - prices.descuento_perro_adicional);
        precioTotal += base + adicional * (numPerros - 1);
      }
    }

    return precioTotal > 0 ? precioTotal : 0;
  };

  // Comentario: recalcular cuando cambie rango/num_perros y no haya override manual ni carga inicial
  useEffect(() => {
    if (!hasUserTouchedForm || isLoadingBooking || isPriceModifiedManually)
      return;
    if (prices && dateRange[0] && dateRange[1]) {
      const precio = calculatePrice(
        dateRange[0],
        dateRange[1],
        form.num_perros
      );
      setForm((prev) => ({ ...prev, total_pago: precio }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dateRange,
    form.num_perros,
    prices,
    isLoadingBooking,
    isPriceModifiedManually,
    hasUserTouchedForm,
  ]);

  // =================== Buscador (runSearch + debounce) ===================
  const runSearch = async (term) => {
    const t = term.trim().toLowerCase();
    if (t.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const resultsMap = new Map();

      // --- Query 1: por perro_nombre ---
      const q1 = query(
        collection(db, "clients"),
        orderBy("perro_nombre"),
        startAt(t),
        endAt(t + "\uf8ff"),
        limit(20)
      );
      const snap1 = await getDocs(q1);
      snap1.forEach((d) => {
        const data = d.data();
        resultsMap.set(d.id, {
          id: d.id,
          perro_nombre: data.perro_nombre || "",
          dueño_nombre: data["dueño_nombre"] || "",
          telefono: data.telefono || "",
          foto_url: data.foto_url || "",
          observaciones: data.observaciones || "",
          patio: !!data.patio,
          fugista: !!data.fugista,
          miedoso: !!data.miedoso,
          microxip: data.microxip || "",
        });
      });

      // --- Query 2: por telefono ---
      const q2 = query(
        collection(db, "clients"),
        orderBy("telefono"),
        startAt(term.trim()), // aquí sin toLowerCase porque es número
        endAt(term.trim() + "\uf8ff"),
        limit(20)
      );
      const snap2 = await getDocs(q2);
      snap2.forEach((d) => {
        const data = d.data();
        resultsMap.set(d.id, {
          id: d.id,
          perro_nombre: data.perro_nombre || "",
          dueño_nombre: data["dueño_nombre"] || "",
          telefono: data.telefono || "",
          foto_url: data.foto_url || "",
          observaciones: data.observaciones || "",
          patio: !!data.patio,
          fugista: !!data.fugista,
          miedoso: !!data.miedoso,
          microxip: data.microxip || "",
        });
      });

      // Convertimos Map a array y filtramos por nombre del dueño si aplica
      let combinedResults = Array.from(resultsMap.values()).filter((c) => {
        const dog = String(c.perro_nombre || "").toLowerCase();
        const owner = String(c["dueño_nombre"] || "").toLowerCase();
        const phone = String(c.telefono || "");
        return (
          dog.includes(t) || owner.includes(t) || phone.includes(term.trim())
        );
      });

      // Orden por perro_nombre
      combinedResults.sort((a, b) =>
        String(a.perro_nombre || "")
          .toLowerCase()
          .localeCompare(String(b.perro_nombre || "").toLowerCase(), "es", {
            sensitivity: "base",
          })
      );

      setSearchResults(combinedResults);
    } catch (e) {
      console.error("Error searching clients:", e);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(searchTerm), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // =================== Selección de cliente ===================
  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setForm((prev) => ({
      ...prev,
      perro_nombre: client.perro_nombre,
      telefono: client.telefono,
      descripcion: "",
    }));
    setSearchResults([]);
    setSearchTerm("");
    setIsPriceModifiedManually(false);
  };

  // =================== Crear cliente ===================
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setClientPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const uploadPhotoToCloudinary = async (file) => {
    // Comentario: subir a Cloudinary (preset y cloudName adaptados a tu proyecto)
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
        perro_nombre: (newClientData.perro_nombre || "").toLowerCase(),
        foto_url: photoURL,
      });
      const newClient = {
        ...newClientData,
        id: docRef.id,
        perro_nombre: (newClientData.perro_nombre || "").toLowerCase(),
        foto_url: photoURL,
      };
      setSelectedClient(newClient);
      setForm((prev) => ({
        ...prev,
        perro_nombre: newClient.perro_nombre,
        telefono: newClient.telefono,
        descripcion: "",
      }));
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
    } finally {
      setLoading(false);
    }
  };

  // =================== Formulario de reserva ===================
  const handleChange = (e) => {
    if (userRole !== "admin" && bookingId) {
      setMessage("No tienes permisos para editar esta reserva.");
      return;
    }
    const { name, value } = e.target;

    if (name === "total_pago") setIsPriceModifiedManually(true);
    if (name === "num_perros") setHasUserTouchedForm(true);

    setForm((prev) => ({
      ...prev,
      [name]:
        name === "num_perros" ||
        name === "total_pago" ||
        name === "pago_anticipado"
          ? Number(value)
          : value,
    }));
  };

  const handleCalendarChange = (newDateRange) => {
    if (userRole !== "admin" && bookingId) {
      setMessage("No tienes permisos para editar esta reserva.");
      return;
    }
    setHasUserTouchedForm(true);
    if (newDateRange[0] && !newDateRange[1]) {
      setDateRange([newDateRange[0], newDateRange[0]]);
    } else {
      setDateRange(newDateRange);
    }
    setIsPriceModifiedManually(false);
  };

  const handleResetPrice = () => {
    setIsPriceModifiedManually(false);
    setHasUserTouchedForm(true);
    if (prices && dateRange[0] && dateRange[1]) {
      const precio = calculatePrice(
        dateRange[0],
        dateRange[1],
        form.num_perros
      );
      setForm((prev) => ({ ...prev, total_pago: precio }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient || !dateRange[0] || !dateRange[1]) {
      setMessage("Selecciona un cliente y un rango de fechas.");
      return;
    }
    if (userRole !== "admin" && bookingId) {
      setMessage("No tienes permisos para editar esta reserva.");
      return;
    }

    setLoading(true);
    try {
      const [fechaEntrada, fechaSalida] = dateRange;
      const f = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      const formattedForm = {
        ...form,
        id_cliente: selectedClient.id,
        fecha_entrada: f(fechaEntrada),
        fecha_salida: f(fechaSalida),
        dueño_nombre: selectedClient.dueño_nombre,
        observaciones: selectedClient.observaciones,
        patio: selectedClient.patio,
        fugista: selectedClient.fugista,
        miedoso: selectedClient.miedoso,
        microxip: selectedClient.microxip,
        foto_url: selectedClient.foto_url,
      };

      if (bookingId) {
        await updateDoc(doc(db, "reservations", bookingId), formattedForm);
        setMessage("Reserva actualizada con éxito.");
      } else {
        await addDoc(collection(db, "reservations"), {
          ...formattedForm,
          is_cancelada: false,
          motivo_cancelacion: "",
        });
        setMessage("Reserva creada con éxito.");
      }
      navigate("/calendario");
    } catch (error) {
      console.error("Error guardando reserva:", error);
      setMessage("Ocurrió un error al guardar la reserva.");
      setLoading(false);
    }
  };

  // =================== Cancelación ===================
  const handleCancelBookingClick = () => {
    if (userRole !== "admin") {
      setMessage("No tienes permisos para cancelar esta reserva.");
      return;
    }
    setShowCancelModal(true);
  };

  const handleCloseModal = () => {
    setShowCancelModal(false);
    setCancellationReason("");
  };

  const handleConfirmCancellation = async () => {
    if (!bookingId) return;
    if (userRole !== "admin") {
      setMessage("No tienes permisos para cancelar esta reserva.");
      handleCloseModal();
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, "reservations", bookingId), {
        is_cancelada: true,
        motivo_cancelacion: cancellationReason,
      });
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

  // =================== Render ===================
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

      {/* Paso 1: Buscar cliente */}
      {!selectedClient && !bookingId && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Paso 1: Buscar Cliente
          </h2>

          <label className="block text-sm font-medium mb-1">
            Cliente / Perro / Teléfono
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por perro, dueño o teléfono"
            className={commonInputClasses}
          />

          {searchLoading ? (
            <div className="text-sm text-gray-500 mt-2">Buscando…</div>
          ) : null}

          {searchResults.length > 0 && (
            <div className="mt-3 border rounded max-h-56 overflow-auto">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectClient(c)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-3"
                >
                  {c.foto_url ? (
                    <img
                      src={c.foto_url}
                      alt={c.perro_nombre}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500">
                      Sin
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{c.perro_nombre}</div>
                    <div className="text-xs text-gray-600">
                      {c["dueño_nombre"]} · 📞 {c.telefono}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Crear cliente - SIEMPRE visible (como pediste) */}
      {!bookingId && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Crear Nuevo Cliente
          </h2>
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
                type="number"
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
              <label className="flex items-center">
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
                <span className="ml-2 text-sm text-gray-700">Patio</span>
              </label>
              <label className="flex items-center">
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
                <span className="ml-2 text-sm text-gray-700">Fugista</span>
              </label>
              <label className="flex items-center">
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
                <span className="ml-2 text-sm text-gray-700">Miedoso</span>
              </label>
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

      {/* Paso 2: Datos de la reserva (cuando hay cliente seleccionado) */}
      {selectedClient && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Paso 2: Datos de la Reserva
          </h2>

          <div className="mb-4 p-3 bg-indigo-50 border-l-4 border-indigo-400 rounded-md flex flex-col items-center space-y-4">
            {selectedClient.foto_url && (
              <div
                className="w-20 h-20 overflow-hidden rounded-full border-2 border-indigo-400"
                onClick={() => {
                  setModalImageUrl(selectedClient.foto_url);
                  setShowImageModal(true);
                }}
              >
                <img
                  src={selectedClient.foto_url}
                  alt={`Foto de ${selectedClient.perro_nombre}`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="w-full text-center">
              <p className="font-bold text-lg text-gray-800">
                Cliente: {selectedClient.dueño_nombre || "—"}
              </p>
              <p className="text-md text-gray-600">
                Perro: {selectedClient.perro_nombre}
              </p>
              <p className="text-sm text-gray-500">
                Teléfono: {selectedClient.telefono || "—"}
              </p>
              {selectedClient.observaciones ? (
                <p className="text-sm text-gray-500 italic">
                  Observaciones: {selectedClient.observaciones}
                </p>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
              <div className="flex-1">
                <Calendar
                  selectRange
                  onChange={handleCalendarChange}
                  value={dateRange}
                  locale="es-ES"
                  minDate={bookingId ? undefined : new Date()}
                  readOnly={isFormReadOnly}
                />
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Número de Perros
                  </label>
                  <input
                    type="number"
                    name="num_perros"
                    value={form.num_perros}
                    onChange={handleChange}
                    className={commonInputClasses}
                    min="1"
                    readOnly={isFormReadOnly}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Precio Total (€)
                    {!isPriceModifiedManually && (
                      <span className="ml-2 text-green-600 text-xs">
                        (Automático)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    name="total_pago"
                    value={form.total_pago}
                    onChange={handleChange}
                    className={commonInputClasses}
                    readOnly={isFormReadOnly}
                  />
                  {isPriceModifiedManually && (
                    <button
                      type="button"
                      onClick={handleResetPrice}
                      className="mt-2 text-sm text-red-600 hover:text-red-800 font-semibold"
                      disabled={isFormReadOnly}
                    >
                      Restablecer precio automático
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Pago Anticipado (€)
                  </label>
                  <input
                    type="number"
                    name="pago_anticipado"
                    value={form.pago_anticipado}
                    onChange={handleChange}
                    className={commonInputClasses}
                    readOnly={isFormReadOnly}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Descripción de la Reserva
                  </label>
                  <textarea
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleChange}
                    className={commonInputClasses}
                    rows="3"
                    readOnly={isFormReadOnly}
                  ></textarea>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || isFormReadOnly}
              className={commonButtonClasses}
            >
              {loading ? "Guardando..." : "Guardar Reserva"}
            </button>

            {bookingId && !isFormReadOnly && (
              <button
                type="button"
                onClick={handleCancelBookingClick}
                className="w-full px-4 py-2 mt-2 font-bold text-white bg-red-600 rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Cancelar Reserva
              </button>
            )}
          </form>
        </div>
      )}

      {/* Modal de cancelación */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-xl font-bold mb-4">Confirmar Cancelación</h3>
            <p className="text-gray-700 mb-4">
              ¿Estás seguro de que quieres cancelar esta reserva? Indica el
              motivo, por favor.
            </p>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className={commonInputClasses + " mb-4"}
              placeholder="Motivo de la cancelación..."
              rows="3"
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cerrar
              </button>
              <button
                onClick={handleConfirmCancellation}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                {loading ? "Cancelando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showImageModal && modalImageUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setShowImageModal(false)}
        >
          <img
            src={modalImageUrl}
            alt="Foto ampliada"
            className="max-w-full max-h-full rounded-lg shadow-lg"
          />
        </div>
      )}
    </div>
  );
};

export default NuevaReservaScreen;
