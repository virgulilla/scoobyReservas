// Comentario: Reportes optimizado. Reduce lecturas filtrando por año en Firestore:
// - where("fecha_salida", ">=", `${year}-01-01`) y <= `${year}-12-31` + orderBy("fecha_salida")
// - Evita procesar reservas de otros años en cliente.
// - Gráfico destruido/recreado como antes.
import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase/config";
import { collection, query, getDocs, where, orderBy } from "firebase/firestore";
import Chart from "chart.js/auto";

const ReportsScreen = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyRevenue, setMonthlyRevenue] = useState(Array(12).fill(0));
  const [annualRevenue, setAnnualRevenue] = useState(0);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  const fetchRevenue = async (selectedYear) => {
    const start = `${selectedYear}-01-01`;
    const end = `${selectedYear}-12-31`;

    // Comentario: filtrar por rango de fecha_salida y ordenar para índice compuesto
    const bookingsQuery = query(
      collection(db, "reservations"),
      where("fecha_salida", ">=", start),
      where("fecha_salida", "<=", end),
      orderBy("fecha_salida")
    );

    const querySnapshot = await getDocs(bookingsQuery);

    const revenueByMonth = Array(12).fill(0);
    let totalAnnualRevenue = 0;

    querySnapshot.forEach((doc) => {
      const booking = doc.data();
      if (booking.is_cancelada) return;
      const salida = booking.fecha_salida; // Comentario: "YYYY-MM-DD"
      const monthIdx = parseInt(salida.slice(5, 7), 10) - 1; // Comentario: 0..11
      const totalPago = booking.total_pago || 0;
      if (monthIdx >= 0 && monthIdx < 12) {
        revenueByMonth[monthIdx] += totalPago;
        totalAnnualRevenue += totalPago;
      }
    });

    setMonthlyRevenue(revenueByMonth);
    setAnnualRevenue(totalAnnualRevenue);
  };

  useEffect(() => {
    fetchRevenue(year);
  }, [year]);

  useEffect(() => {
    if (chartInstance.current) chartInstance.current.destroy();

    if (chartRef.current) {
      const ctx = chartRef.current.getContext("2d");
      chartInstance.current = new Chart(ctx, {
        type: "bar",
        data: {
          labels: months,
          datasets: [
            {
              label: `Ingresos Mensuales (${year})`,
              data: monthlyRevenue,
              backgroundColor: "rgba(75, 192, 192, 0.6)",
              borderColor: "rgba(75, 192, 192, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "Ingresos (€)" },
            },
          },
        },
      });
    }
  }, [monthlyRevenue, year]);

  const handleYearChange = (event) => setYear(Number(event.target.value));

  return (
    <div className="p-4 pb-16 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Reportes Financieros
      </h1>

      <div className="flex items-center space-x-2 mb-6">
        <label htmlFor="year-select" className="text-gray-700 font-semibold">
          Seleccionar Año:
        </label>
        <select
          id="year-select"
          value={year}
          onChange={handleYearChange}
          className="rounded-md border-gray-300 shadow-sm"
        >
          {Array.from(
            { length: 5 },
            (_, i) => new Date().getFullYear() - 2 + i
          ).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-2 text-gray-800">
          Resumen del Año {year}
        </h2>
        <div className="flex justify-between items-center">
          <p className="text-lg text-gray-600">Ingresos Acumulados:</p>
          <p className="text-3xl font-bold text-indigo-600">
            {annualRevenue.toFixed(2)} €
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Ingresos Mensuales
        </h2>
        <div className="relative h-80">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Detalle Mensual
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ingresos
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {months.map((month, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {month}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {monthlyRevenue[index].toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsScreen;
