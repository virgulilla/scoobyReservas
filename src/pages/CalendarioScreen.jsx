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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [perrosPernoctando, setPerrosPernoctando] = useState(0);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

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

  const fetchBookings = async (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;

    // Obtener todas las reservas que cumplen la condición de fecha
    const bookingsQuery = query(
      collection(db, "reservations"),
      where("fecha_entrada", "<=", dateString)
    );

    const querySnapshot = await getDocs(bookingsQuery);
    const fetchedBookings = [];
    let pernoctandoCount = 0;

    querySnapshot.forEach((doc) => {
      const bookingData = { id: doc.id, ...doc.data() };

      // Filtra las reservas canceladas antes de mostrarlas
      if (bookingData.is_cancelada === true) {
        return;
      }

      if (bookingData.fecha_salida >= dateString) {
        fetchedBookings.push(bookingData);

        if (bookingData.fecha_salida !== dateString) {
          pernoctandoCount += bookingData.num_perros;
        }
      }
    });

    setBookings(fetchedBookings);
    setPerrosPernoctando(pernoctandoCount);
  };

  useEffect(() => {
    // Escuchar el estado de autenticación para obtener el UID del usuario
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Si hay un usuario, obtener su rol desde la colección 'users'
        fetchUserRole(user.uid);
      } else {
        setUserRole("user");
      }
    });

    fetchBookings(selectedDate);

    return () => unsubscribeAuth();
  }, [selectedDate]);

  const handleBookingClick = (bookingId) => {
    if (userRole === "admin") {
      navigate(`/editar-reserva/${bookingId}`);
    }
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
          Perros pernoctando:{" "}
          <span className="font-bold">{perrosPernoctando}</span>
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
            const pendientePagar = booking.total_pago - pagoAnticipado;

            return (
              <div
                key={booking.id}
                className={cardClasses(isEntrada, isSalida)}
                onClick={() => handleBookingClick(booking.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900">
                      {booking.perro_nombre}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      Teléfono: {booking.telefono}
                    </p>
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

                {isEntrada && (
                  <p className="text-sm font-semibold text-green-600 mt-1">
                    Día de entrada
                  </p>
                )}
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
