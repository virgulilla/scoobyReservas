// Comentario: Pantalla de morosos con búsqueda de cliente (autocomplete) y CRUD básico en Firestore.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  startAt,
  endAt,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/config";

const MorososScreen = () => {
  // Comentario: estado para listado de morosos pendientes (tiempo real)
  const [morosos, setMorosos] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  // Comentario: estado del formulario
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  // Comentario: debounce para búsqueda
  const debounceRef = useRef(null);

  // Comentario: suscripción a morosos no pagados
  useEffect(() => {
    // Comentario: pagado == false y ordenado por fecha desc
    const q = query(
      collection(db, "morosos"),
      where("pagado", "==", false),
      orderBy("fecha", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setMorosos(list);
        setLoadingList(false);
      },
      (err) => {
        console.error("Error onSnapshot morosos:", err);
        setLoadingList(false);
      }
    );
    return () => unsub();
  }, []);

  // Comentario: ejecutar la búsqueda contra Firestore (prefijo por perro_nombre)
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
        });
      });

      // --- Query 2: por telefono ---
      const q2 = query(
        collection(db, "clients"),
        orderBy("telefono"),
        startAt(term.trim()), // no pasamos a minúsculas
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
        });
      });

      // --- Convertir a array ---
      let combinedResults = Array.from(resultsMap.values());

      // --- Filtro adicional por nombre del dueño (en cliente) ---
      combinedResults = combinedResults.filter((c) => {
        const dog = String(c.perro_nombre || "").toLowerCase();
        const owner = String(c["dueño_nombre"] || "").toLowerCase();
        const phone = String(c.telefono || "");
        return (
          dog.includes(t) || owner.includes(t) || phone.includes(term.trim())
        );
      });

      // --- Ordenar por perro_nombre ---
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

  // Comentario: debounce de búsqueda
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(searchTerm), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Comentario: crear moroso
  const addMoroso = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;
    const value = parseFloat(amount);
    if (!value || value <= 0) return;

    try {
      await addDoc(collection(db, "morosos"), {
        clienteId: selectedClient.id,
        clienteNombre: selectedClient["dueño_nombre"] || "", // Comentario: guardar también nombre del dueño
        perroNombre: selectedClient.perro_nombre || "",
        telefono: selectedClient.telefono || "",
        cantidad: value,
        motivo: reason.trim(),
        pagado: false,
        fecha: serverTimestamp(),
      });

      // Comentario: limpiar formulario
      setSelectedClient(null);
      setSearchTerm("");
      setSearchResults([]);
      setAmount("");
      setReason("");
    } catch (err) {
      console.error("Error creando moroso:", err);
    }
  };

  // Comentario: marcar como pagado
  const markPaid = async (id) => {
    try {
      await updateDoc(doc(db, "morosos", id), { pagado: true });
    } catch (err) {
      console.error("Error marcando pagado:", err);
    }
  };

  // Comentario: totales
  const totalDebt = useMemo(
    () =>
      morosos.reduce(
        (acc, m) => acc + (typeof m.cantidad === "number" ? m.cantidad : 0),
        0
      ),
    [morosos]
  );

  return (
    <div className="p-4 pb-20 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Morosos</h1>

      {/* Comentario: Formulario alta */}
      <form onSubmit={addMoroso} className="bg-white rounded shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Nuevo moroso</h2>

        {/* Comentario: selector de cliente con búsqueda */}
        <label className="block text-sm font-medium mb-1">
          Cliente / Perro
        </label>
        {selectedClient ? (
          <div className="flex items-center justify-between border rounded p-2 mb-3 bg-green-50">
            <div className="flex items-center gap-3">
              {selectedClient.foto_url ? (
                <img
                  src={selectedClient.foto_url}
                  alt={selectedClient.perro_nombre}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                  Sin foto
                </div>
              )}
              <div>
                <div className="font-medium">{selectedClient.perro_nombre}</div>
                <div className="text-xs text-gray-600">
                  Dueño: {selectedClient["dueño_nombre"]} · 📞{" "}
                  {selectedClient.telefono}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="text-sm text-red-600 hover:underline"
              onClick={() => {
                setSelectedClient(null);
                setSearchTerm("");
                setSearchResults([]);
              }}
            >
              Cambiar
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por perro, dueño o teléfono"
              className="w-full border rounded p-2 mb-2"
            />
            {searchLoading ? (
              <div className="text-sm text-gray-500 mb-2">Buscando…</div>
            ) : null}

            {searchResults.length > 0 && (
              <div className="border rounded max-h-56 overflow-auto mb-3">
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClient(c)}
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
                      <div className="font-medium text-sm">
                        {c.perro_nombre}
                      </div>
                      <div className="text-xs text-gray-600">
                        {c["dueño_nombre"]} · 📞 {c.telefono}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Cantidad (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Motivo</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Día extra de alojamiento"
              className="w-full border rounded p-2"
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            type="submit"
            disabled={!selectedClient || !amount || parseFloat(amount) <= 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            Añadir
          </button>
        </div>
      </form>

      {/* Comentario: Resumen */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Pendientes de pago</h2>
        <div className="text-sm text-gray-700">
          Total: <span className="font-semibold">{totalDebt.toFixed(2)} €</span>
        </div>
      </div>

      {/* Comentario: lista de morosos */}
      <div className="bg-white rounded shadow divide-y">
        {loadingList ? (
          <div className="p-4 text-gray-500">Cargando…</div>
        ) : morosos.length === 0 ? (
          <div className="p-4 text-gray-500">No hay morosos pendientes.</div>
        ) : (
          morosos.map((m) => (
            <div
              key={m.id}
              className="p-3 flex items-start justify-between gap-3"
            >
              <div>
                <div className="font-semibold">
                  {m.perroNombre || "Perro"} —{" "}
                  {typeof m.cantidad === "number"
                    ? m.cantidad.toFixed(2)
                    : m.cantidad}{" "}
                  €
                </div>
                <div className="text-sm text-gray-700">
                  {m.clienteNombre || "Cliente"}{" "}
                  {m.telefono ? `· 📞 ${m.telefono}` : ""}
                </div>
                {m.motivo && (
                  <div className="text-sm text-gray-500 mt-1">
                    Motivo: {m.motivo}
                  </div>
                )}
              </div>
              <button
                onClick={() => markPaid(m.id)}
                className="self-center text-green-700 border border-green-600 px-3 py-1 rounded hover:bg-green-50 text-sm"
              >
                Marcar pagado
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MorososScreen;
