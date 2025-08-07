import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/config";
import { doc, getDoc, addDoc, updateDoc, collection } from "firebase/firestore";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const DIAS_LARGA_ESTANCIA = 30; // Primeras 30 noches a precio normal

const NuevaReservaScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();

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

  const [dateRange, setDateRange] = useState([null, null]);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

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

    // Lógica para estancias de 1 noche
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

    // Lógica para estancias de 2 o más noches (incluyendo larga estancia)
    for (let i = 0; i < numNoches; i++) {
      const fechaActual = new Date(normalizedStartDate);
      fechaActual.setDate(normalizedStartDate.getDate() + i);

      let precioPorNochePrimerPerro = 0;
      const mesActual = fechaActual.getMonth(); // 0 = Enero, 7 = Agosto

      // Regla de agosto (prioritaria y sin descuento)
      if (mesActual === 7) {
        precioPorNochePrimerPerro = prices.precio_agosto;
        precioTotal += precioPorNochePrimerPerro * numPerros;
      }
      // Regla de larga estancia
      else if (i >= DIAS_LARGA_ESTANCIA) {
        precioPorNochePrimerPerro = prices.precio_larga_estancia;
        let precioPorNocheConDescuento = 0;
        if (numPerros > 1) {
          // Aplicar descuento por perro adicional
          const precioPerroAdicional =
            precioPorNochePrimerPerro * (1 - prices.descuento_perro_adicional);
          precioPorNocheConDescuento =
            precioPorNochePrimerPerro + precioPerroAdicional * (numPerros - 1);
        } else {
          precioPorNocheConDescuento = precioPorNochePrimerPerro;
        }
        precioTotal += precioPorNocheConDescuento;
      }
      // Regla de precio estándar (las primeras noches)
      else {
        precioPorNochePrimerPerro = prices.precio_dia_adulto;
        let precioPorNocheConDescuento = 0;
        if (numPerros > 1) {
          // Aplicar descuento por perro adicional
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

  useEffect(() => {
    const fetchData = async () => {
      const pricesDocRef = doc(db, "prices", "tarifas2");
      const pricesDocSnap = await getDoc(pricesDocRef);
      if (pricesDocSnap.exists()) {
        setPrices(pricesDocSnap.data());
      } else {
        console.error(
          "Documento de precios 'tarifas2' no encontrado. Asegúrate de crearlo en PreciosScreen."
        );
      }

      if (id) {
        const docRef = doc(db, "reservations", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const entrada = new Date(data.fecha_entrada);
          const salida = new Date(data.fecha_salida);
          setDateRange([entrada, salida]);
          setForm(data);
        } else {
          console.error("No se encontró la reserva con ese ID:", id);
          navigate("/calendario");
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [id, navigate]);

  useEffect(() => {
    if (prices && dateRange[0] && dateRange[1]) {
      const precioCalculado = calculatePrice(
        dateRange[0],
        dateRange[1],
        form.num_perros
      );
      setForm((prevForm) => ({ ...prevForm, total_pago: precioCalculado }));
    }
  }, [dateRange, form.num_perros, prices]);

  const handleChange = (e) => {
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

  const handleCalendarChange = (newDateRange) => {
    if (newDateRange[0] && !newDateRange[1]) {
      setDateRange([newDateRange[0], newDateRange[0]]);
    } else {
      setDateRange(newDateRange);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const [fechaEntrada, fechaSalida] = dateRange;
      const formattedForm = {
        ...form,
        fecha_entrada: fechaEntrada.toISOString().split("T")[0],
        fecha_salida: fechaSalida.toISOString().split("T")[0],
      };

      if (id) {
        const docRef = doc(db, "reservations", id);
        await updateDoc(docRef, formattedForm);
        console.log("Reserva actualizada con ID:", id);
      } else {
        const docRef = await addDoc(
          collection(db, "reservations"),
          formattedForm
        );
        console.log("Nueva reserva creada con ID:", docRef.id);
      }
      navigate("/calendario");
    } catch (error) {
      console.error("Error al guardar la reserva:", error);
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowCancellationModal(true);
  };

  const confirmCancellation = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "reservations", id);
      await updateDoc(docRef, {
        is_cancelada: true,
        motivo_cancelacion: cancellationReason,
      });
      console.log("Reserva cancelada con éxito");
      navigate("/calendario");
    } catch (error) {
      console.error("Error al cancelar la reserva:", error);
      setLoading(false);
    } finally {
      setShowCancellationModal(false);
    }
  };

  const cancelCancellation = () => {
    setShowCancellationModal(false);
    setCancellationReason("");
  };

  const pageTitle = id ? "Editar Reserva" : "Nueva Reserva";

  if (loading) {
    return <div className="p-4 text-center">Cargando...</div>;
  }

  return (
    <div className="p-4 pb-16 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">{pageTitle}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-gray-700">Rango de Fechas</span>
          <Calendar
            onChange={handleCalendarChange}
            value={dateRange}
            selectRange={true}
            className="mt-1 w-full rounded-md shadow-sm"
          />
        </label>
        <label className="block">
          <span className="text-gray-700">Nombre del Perro</span>
          <input
            type="text"
            name="perro_nombre"
            value={form.perro_nombre}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            required
          />
        </label>
        <label className="block">
          <span className="text-gray-700">Teléfono</span>
          <input
            type="tel"
            name="telefono"
            value={form.telefono}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </label>
        <label className="block">
          <span className="text-gray-700">Número de Perros</span>
          <input
            type="number"
            name="num_perros"
            value={form.num_perros}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            min="1"
            required
          />
        </label>
        <div className="flex space-x-4">
          <label className="block flex-1">
            <span className="text-gray-700">Total a Pagar (€)</span>
            <input
              type="number"
              name="total_pago"
              value={form.total_pago}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              required
            />
          </label>
          <label className="block flex-1">
            <span className="text-gray-700">Pago Anticipado (€)</span>
            <input
              type="number"
              name="pago_anticipado"
              value={form.pago_anticipado}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-gray-700">Descripción</span>
          <textarea
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            rows="3"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          ></textarea>
        </label>
        <div className="flex space-x-4">
          <button
            type="submit"
            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            disabled={loading}
          >
            {loading ? "Guardando..." : "Guardar Reserva"}
          </button>
          {id && (
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              disabled={loading}
            >
              {loading ? "Eliminando..." : "Cancelar Reserva"}
            </button>
          )}
        </div>
      </form>

      {/* Modal de confirmación de cancelación */}
      {showCancellationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="relative p-8 bg-white w-96 max-w-md mx-auto rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-4">Confirmar Cancelación</h2>
            <p className="mb-4">
              ¿Estás seguro de que quieres cancelar esta reserva?
            </p>

            <label className="block mb-4">
              <span className="text-gray-700">
                Motivo de la cancelación (opcional)
              </span>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows="3"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              ></textarea>
            </label>

            <div className="flex space-x-4">
              <button
                onClick={confirmCancellation}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                Confirmar Cancelación
              </button>
              <button
                onClick={cancelCancellation}
                className="flex-1 bg-gray-300 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NuevaReservaScreen;
