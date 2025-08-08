// Comentario: Calendario con conteo de "Duermen" y "Patio" (JS puro, sin TS)
import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { db, auth } from "../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

const CalendarioScreen = () => {
  // Comentario: estado de la fecha seleccionada
  const [selectedDate, setSelectedDate] = useState(new Date());
  // Comentario: reservas del día (entradas, salidas y pernoctas activas)
  const [bookings, setBookings] = useState([]);
  // Comentario: total de perros que duermen esa noche
  const [perrosPernoctando, setPerrosPernoctando] = useState(0);
  // Comentario: total de perros pernoctando cuyo cliente tiene patio === true
  const [patioCount, setPatioCount] = useState(0);
  // Comentario: rol de usuario (admin o user)
  const [userRole, setUserRole] = useState(null);
  const [patioClientIds, setPatioClientIds] = useState([]);

  const navigate = useNavigate();

  // Comentario: obtiene el rol del usuario autenticado
  const fetchUserRole = async (userId) => {
    if (!userId) {
      setUserRole("user");
      return;
    }
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      setUserRole(userDocSnap.data().role || "user");
    } else {
      setUserRole("user");
    }
  };

  // Comentario: obtiene reservas activas para la fecha y calcula "Duermen" y "Patio"
  const fetchBookings = async (date) => {
    // Comentario: formateo yyyy-mm-dd
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;

    // Comentario: traer reservas con fecha_entrada <= día y que no estén canceladas
    const bookingsQuery = query(
      collection(db, "reservations"),
      where("fecha_entrada", "<=", dateString)
    );

    const querySnapshot = await getDocs(bookingsQuery);

    const fetchedBookings = [];
    let pernoctandoCount = 0;

    querySnapshot.forEach((d) => {
      const bookingData = { id: d.id, ...d.data() };

      // Comentario: omitir canceladas
      if (bookingData.is_cancelada === true) return;

      // Comentario: reserva activa si la salida es >= el día seleccionado
      if (bookingData.fecha_salida >= dateString) {
        fetchedBookings.push(bookingData);

        // Comentario: pernocta si no sale en el mismo día
        if (bookingData.fecha_salida !== dateString) {
          pernoctandoCount += bookingData.num_perros || 0;
        }
      }
    });

    setBookings(fetchedBookings);
    setPerrosPernoctando(pernoctandoCount);

    // --------- Cálculo de "Patio" ---------
    // Comentario: sólo cuentan las reservas que pernoctan (no salen hoy)
    const overnightBookings = fetchedBookings.filter(
      (b) => b.fecha_salida !== dateString
    );

    // Comentario: acumular perros por cliente_id
    const perrosPorCliente = overnightBookings.reduce((acc, b) => {
      if (!b.id_cliente) return acc; // Recomendado: asegurar que reservas tengan cliente_id
      acc[b.id_cliente] = (acc[b.id_cliente] || 0) + (b.num_perros || 0);
      return acc;
    }, {});

    const allClientIds = Object.keys(perrosPorCliente);

    // Comentario: si no hay cliente_id, el total es 0
    if (allClientIds.length === 0) {
      setPatioCount(0);
      return;
    }

    // Comentario: util para trocear en lotes de 10 ids (límite de 'in')
    const chunk = (arr, size) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
      );

    let patioTotal = 0;
    const patioIdsLocal = new Set();

    // Comentario: consultar clientes por lotes y sumar si patio === true
    for (const group of chunk(allClientIds, 10)) {
      const clientsSnap = await getDocs(
        query(collection(db, "clients"), where("__name__", "in", group))
      );
      clientsSnap.forEach((cDoc) => {
        const cData = cDoc.data();
        if (cData && cData.patio === true) {
          patioTotal += 1;
          patioIdsLocal.add(cDoc.id);
        }
      });
    }

    setPatioCount(patioTotal);
    setPatioClientIds(Array.from(patioIdsLocal));
  };

  // Comentario: suscripción a auth y recálculo al cambiar fecha
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchUserRole(user.uid);
      } else {
        setUserRole("user");
      }
    });

    fetchBookings(selectedDate);

    return () => unsubscribeAuth();
    // Comentario: dependemos de selectedDate para refrescar datos
  }, [selectedDate]);

  // Comentario: navegación a la edición de reserva
  const handleBookingClick = (bookingId) => {
    navigate(`/editar-reserva/${bookingId}`);
  };

  if (userRole === null) {
    return <div className="p-4 text-center">Cargando...</div>;
  }

  const isDisabled = userRole !== "admin";
  const cardClasses = (isEntrada, isSalida) =>
    `p-3 rounded-lg shadow-sm transition-colors duration-200 ${
      isEntrada
        ? "bg-green-100 border-l-4 border-green-500"
        : isSalida
        ? "bg-red-100 border-l-4 border-red-500"
        : "bg-white"
    } ${!isDisabled ? "cursor-pointer" : "cursor-default"}`;

  return (
    <div className="p-4 pb-16 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Calendario de Reservas
      </h1>

      <div className="bg-white p-4 rounded-lg shadow-md mb-4">
        <Calendar
          onChange={setSelectedDate}
          value={selectedDate}
          locale="es-ES"
          className="w-full"
        />
      </div>

      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold text-gray-700">
          Reservas para el {selectedDate.toLocaleDateString("es-ES")}
        </h2>
        <p className="text-md text-gray-600">
          Duermen: <span className="font-bold">{perrosPernoctando}</span>
          {" · "}
          Patio: <span className="font-bold">{patioCount}</span>
        </p>
      </div>

      <div className="space-y-3">
        {bookings.length > 0 ? (
          bookings.map((booking) => {
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
            const day = String(selectedDate.getDate()).padStart(2, "0");
            const dateString = `${year}-${month}-${day}`;

            const isEntrada = booking.fecha_entrada === dateString;
            const isSalida = booking.fecha_salida === dateString;
            const pagoAnticipado = booking.pago_anticipado || 0;
            const pendientePagar = (booking.total_pago || 0) - pagoAnticipado;
            const isPatio =
              booking.id_cliente && patioClientIds.includes(booking.id_cliente);

            return (
              <div
                key={booking.id}
                className={cardClasses(isEntrada, isSalida)}
                onClick={() => !isDisabled && handleBookingClick(booking.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900">
                      {booking.perro_nombre}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      Teléfono: {booking.telefono}
                    </p>
                    {isPatio && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300"
                        title="Cliente con acceso a patio"
                        aria-label="Cliente con acceso a patio"
                      >
                        Patio
                      </span>
                    )}
                  </div>

                  {isSalida && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">
                        Total: {booking.total_pago} €
                      </p>
                      {pendientePagar > 0 ? (
                        <p className="text-sm text-red-500">
                          Pendiente: {pendientePagar} €
                        </p>
                      ) : (
                        <p className="text-sm text-green-500">Total pagado</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center text-gray-500">
            No hay reservas para este día.
          </p>
        )}
      </div>

      {userRole === "admin" && (
        <button
          onClick={() => navigate("/nueva-reserva")}
          className="fixed bottom-20 right-4 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-colors duration-200"
          aria-label="Crear nueva reserva"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default CalendarioScreen;
