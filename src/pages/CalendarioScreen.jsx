// Comentario: Calendario optimizado. Mantiene sólo estado mínimo y usa caché global de clients.
// - Estados: selectedDate, bookings, cacheTick (para re-render tras llenar caché)
// - Cálculos derivados con useMemo: Duermen, Pend. llegar, Pend. salir, Patio
import React, { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import SwipeItem from "../components/SwipeItem";
import { useApp } from "../state/AppContext";

const chunk = (arr, size = 10) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

// Comentario: util local yyyy-mm-dd
const toYmd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const CalendarioScreen = () => {
  // Comentario: contexto global para rol y caché de clients
  const { role, user, clientNameCache, clientPatioCache } = useApp();
  const isAdmin = role === "admin";
  const navigate = useNavigate();

  // Comentario: estado mínimo
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [cacheTick, setCacheTick] = useState(0); // fuerza re-render tras llenar caché

  // Comentario: cargar reservas activas para la fecha
  useEffect(() => {
    const load = async () => {
      const dateString = toYmd(selectedDate);
      const q = query(
        collection(db, "reservations"),
        where("fecha_entrada", "<=", dateString)
      );
      const snap = await getDocs(q);

      const list = [];
      snap.forEach((d) => {
        const r = { id: d.id, ...d.data() };
        if (r.is_cancelada === true) return;
        if (r.fecha_salida >= dateString) list.push(r);
      });

      setBookings(list);
    };
    load();
  }, [selectedDate]);

  // Comentario: resolver datos de clients faltantes en caché (nombre y patio)
  useEffect(() => {
    const dateString = toYmd(selectedDate);

    // Comentario: sólo miramos los que pernoctan (respetando tu lógica actual)
    const overnight = bookings.filter((b) => b.fecha_salida !== dateString);

    const allIds = Array.from(
      new Set(
        overnight
          .map((b) => b.id_cliente)
          .filter((id) => typeof id === "string" && id.length > 0)
      )
    );

    const missing = allIds.filter(
      (id) => !clientNameCache.has(id) || !clientPatioCache.has(id)
    );
    if (missing.length === 0) return;

    (async () => {
      for (const group of chunk(missing, 10)) {
        const snap = await getDocs(
          query(collection(db, "clients"), where("__name__", "in", group))
        );
        snap.forEach((cDoc) => {
          const c = cDoc.data();
          const nombrePerro =
            c?.perro_nombre ?? c?.nombre_perro ?? c?.dog_name ?? null;
          if (nombrePerro) clientNameCache.set(cDoc.id, nombrePerro);
          clientPatioCache.set(cDoc.id, !!c?.patio);
        });
      }
      setCacheTick((t) => t + 1);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, selectedDate]);

  // Comentario: cálculos derivados
  const dateString = toYmd(selectedDate);

  const perrosPernoctando = useMemo(() => {
    // Comentario: perros que no salen hoy (suma num_perros)
    return bookings.reduce((acc, b) => {
      if (b.fecha_salida !== dateString) acc += b.num_perros || 0;
      return acc;
    }, 0);
  }, [bookings, dateString]);

  const pendLlegar = useMemo(() => {
    // Comentario: entradas hoy no confirmadas
    return bookings.reduce((acc, b) => {
      if (b.fecha_entrada === dateString && !b.checked_in) {
        acc += b.num_perros || 0;
      }
      return acc;
    }, 0);
  }, [bookings, dateString]);

  const pendSalir = useMemo(() => {
    // Comentario: salidas hoy no confirmadas
    return bookings.reduce((acc, b) => {
      if (b.fecha_salida === dateString && !b.checked_out) {
        acc += b.num_perros || 0;
      }
      return acc;
    }, 0);
  }, [bookings, dateString]);

  // Comentario: "Patio" respetando tu cálculo actual (cuenta clientes, no perros)
  const { patioCount, patioIds } = useMemo(() => {
    const overnight = bookings.filter((b) => b.fecha_salida !== dateString);
    const ids = Array.from(
      new Set(
        overnight
          .map((b) => b.id_cliente)
          .filter((id) => typeof id === "string" && id.length > 0)
      )
    );

    const idsConPatio = ids.filter((id) => clientPatioCache.get(id) === true);
    return { patioCount: idsConPatio.length, patioIds: idsConPatio };
    // cacheTick garantiza re-evaluación tras rellenar caché
  }, [bookings, dateString, clientPatioCache, cacheTick]);

  // Comentario: helpers UI
  const displayDogName = (booking) => {
    if (booking.id_cliente && clientNameCache.has(booking.id_cliente)) {
      return clientNameCache.get(booking.id_cliente);
    }
    return booking.perro_nombre || "Sin nombre";
  };

  const handleBookingClick = (bookingId) => {
    if (!isAdmin) return;
    navigate(`/editar-reserva/${bookingId}`);
  };

  const toggleCheck = async (bookingId, field, current) => {
    try {
      await updateDoc(doc(db, "reservations", bookingId), {
        [field]: !current,
      });
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, [field]: !current } : b))
      );
    } catch (e) {
      console.error("Error al actualizar estado:", e);
    }
  };

  if (!user) {
    return <div className="p-4 text-center">Cargando…</div>;
  }

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
          {" · "}
          Venir: <span className="font-bold">{pendLlegar}</span>
          {" · "}
          Irse: <span className="font-bold">{pendSalir}</span>
        </p>
      </div>

      <div className="space-y-3">
        {bookings.length > 0 ? (
          bookings.map((booking) => {
            const isEntrada = booking.fecha_entrada === dateString;
            const isSalida = booking.fecha_salida === dateString;

            // Comentario: campo a marcar
            const field = isEntrada
              ? "checked_in"
              : isSalida
              ? "checked_out"
              : null;
            const isDone = isEntrada
              ? !!booking.checked_in
              : isSalida
              ? !!booking.checked_out
              : false;

            // Comentario: estilos por tipo/estado
            const bgBase = isEntrada
              ? "bg-green-100 border-l-4 border-green-500"
              : isSalida
              ? "bg-red-100 border-l-4 border-red-500"
              : "bg-white";
            const bgDone = isEntrada
              ? "bg-green-200"
              : isSalida
              ? "bg-red-200"
              : "bg-white";
            const cardCls = `p-3 rounded-lg shadow-sm transition-colors duration-200 cursor-pointer ${
              isDone ? bgDone : bgBase
            }`;

            const content = (
              <div
                className={cardCls}
                onClick={() => handleBookingClick(booking.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900">
                      {displayDogName(booking)}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      Teléfono: {booking.telefono}
                    </p>

                    {/* Comentario: Badges */}
                    <div className="mt-1 flex gap-2">
                      {isEntrada && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                            isDone
                              ? "bg-green-600 text-white border-green-700"
                              : "bg-green-100 text-green-800 border-green-300"
                          }`}
                        >
                          {isDone ? "Llegó" : "Pendiente llegada"}
                        </span>
                      )}
                      {isSalida && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                            isDone
                              ? "bg-red-600 text-white border-red-700"
                              : "bg-red-100 text-red-800 border-red-300"
                          }`}
                        >
                          {isDone ? "Salió" : "Pendiente salida"}
                        </span>
                      )}
                      {/* Comentario: Patio (respetando tu lógica actual) */}
                      {booking.id_cliente &&
                        patioIds.includes(booking.id_cliente) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                            Patio
                          </span>
                        )}
                    </div>
                  </div>

                  {isSalida && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">
                        Total: {booking.total_pago} €
                      </p>
                      {(booking.total_pago || 0) -
                        (booking.pago_anticipado || 0) >
                      0 ? (
                        <p className="text-sm text-red-500">
                          Pendiente:{" "}
                          {(booking.total_pago || 0) -
                            (booking.pago_anticipado || 0)}{" "}
                          €
                        </p>
                      ) : (
                        <p className="text-sm text-green-500">Total pagado</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );

            if (!isEntrada && !isSalida) {
              return <div key={booking.id}>{content}</div>;
            }

            return (
              <SwipeItem
                key={booking.id}
                onConfirm={() =>
                  field && toggleCheck(booking.id, field, isDone)
                }
                threshold={96}
                completed={isDone}
                className=""
              >
                {content}
              </SwipeItem>
            );
          })
        ) : (
          <p className="text-center text-gray-500">
            No hay reservas para este día.
          </p>
        )}
      </div>

      {isAdmin && (
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
