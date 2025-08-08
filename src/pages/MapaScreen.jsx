// Comentario: Mapa de instalaciones (perros desde Firestore) — drag & drop en memoria
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { db } from "../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Comentario: layout — B18/B19 ocupan 2 filas (doble alto). P5 movido entre B1..B5 y P4.
const SPACES = [
  // ---- Patios
  { id: "P5", label: "P5", type: "patio", c1: 1, c2: 9, r1: 6, r2: 12 },
  { id: "P4", label: "P4", type: "patio", c1: 1, c2: 9, r1: 8, r2: 12 },
  { id: "P1", label: "P1", type: "patio", c1: 9, c2: 12, r1: 8, r2: 10 },
  { id: "P2", label: "P2", type: "patio", c1: 9, c2: 12, r1: 10, r2: 11 },
  { id: "P3", label: "P3", type: "patio", c1: 9, c2: 12, r1: 11, r2: 12 },

  // ---- Bloque superior (4 filas). Columna 1 libre como margen.
  // Fila 1
  { id: "B9", label: "B9", type: "box", c1: 2, c2: 4, r1: 1, r2: 2 },
  { id: "B10", label: "B10", type: "box", c1: 4, c2: 6, r1: 1, r2: 2 },
  /* vacío en el centro */
  { id: "B17", label: "B17", type: "box", c1: 7, c2: 9, r1: 1, r2: 2 },
  // B18 doble alto ⇒ ocupa filas 1-3
  { id: "B18", label: "B18", type: "box", c1: 9, c2: 11, r1: 1, r2: 3 },

  // Fila 2
  { id: "B8", label: "B8", type: "box", c1: 2, c2: 4, r1: 2, r2: 3 },
  { id: "B11", label: "B11", type: "box", c1: 4, c2: 6, r1: 2, r2: 3 },
  /* vacío */
  { id: "B16", label: "B16", type: "box", c1: 7, c2: 9, r1: 2, r2: 3 },

  // Fila 3
  { id: "B7", label: "B7", type: "box", c1: 2, c2: 4, r1: 3, r2: 4 },
  { id: "B12", label: "B12", type: "box", c1: 4, c2: 6, r1: 3, r2: 4 },
  /* vacío */
  { id: "B15", label: "B15", type: "box", c1: 7, c2: 9, r1: 3, r2: 4 },
  // B19 doble alto ⇒ ocupa filas 3-5
  { id: "B19", label: "B19", type: "box", c1: 9, c2: 11, r1: 3, r2: 5 },

  // Fila 4
  { id: "B6", label: "B6", type: "box", c1: 2, c2: 3, r1: 4, r2: 5 }, // medio ancho
  { id: "B13", label: "B13", type: "box", c1: 4, c2: 6, r1: 4, r2: 5 },
  /* vacío */
  { id: "B14", label: "B14", type: "box", c1: 7, c2: 9, r1: 4, r2: 5 },

  // Fila 5 (línea en blanco)
  // Fila 6 (B1..B5)
  { id: "B1", label: "B1", type: "box", c1: 2, c2: 4, r1: 5, r2: 6 },
  { id: "B2", label: "B2", type: "box", c1: 4, c2: 6, r1: 5, r2: 6 },
  { id: "B3", label: "B3", type: "box", c1: 6, c2: 8, r1: 5, r2: 6 },
  { id: "B4", label: "B4", type: "box", c1: 8, c2: 10, r1: 5, r2: 6 },
  { id: "B5", label: "B5", type: "box", c1: 10, c2: 12, r1: 5, r2: 6 },
];

const MapaScreen = () => {
  const [pool, setPool] = useState([]);
  const [assignments, setAssignments] = useState(() =>
    SPACES.reduce((acc, s) => ({ ...acc, [s.id]: [] }), {})
  );
  const [loading, setLoading] = useState(true);
  const [hoverSpace, setHoverSpace] = useState(null);

  // Comentario: cargar perros desde Firestore (reservas activas hoy)
  useEffect(() => {
    const fetchDogs = async () => {
      setLoading(true);
      try {
        const today = todayStr();
        const q = query(
          collection(db, "reservations"),
          where("fecha_entrada", "<=", today)
        );
        const snap = await getDocs(q);
        const dogs = [];
        snap.forEach((d) => {
          const r = { id: d.id, ...d.data() };
          if (r.is_cancelada) return;
          if ((r.fecha_salida || "") < today) return;
          const nombre = (r.perro_nombre || "").trim();
          if (nombre) dogs.push({ id: d.id, name: nombre });
        });
        dogs.sort((a, b) =>
          a.name
            .toLowerCase()
            .localeCompare(b.name.toLowerCase(), "es", { sensitivity: "base" })
        );
        setPool(dogs);
      } catch (e) {
        console.error("Error cargando perros:", e);
        setPool([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDogs();
  }, []);

  // Comentario: helpers drag & drop (sin cambios de lógica)
  const removeFromAll = useCallback((dogId) => {
    setAssignments((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next))
        next[k] = next[k].filter((d) => d.id !== dogId);
      return next;
    });
    setPool((prev) => prev.filter((d) => d.id !== dogId));
  }, []);

  const dropOnPool = useCallback(
    (dog) => {
      removeFromAll(dog.id);
      setPool((prev) => [...prev, dog]);
    },
    [removeFromAll]
  );

  const dropOnSpace = useCallback(
    (spaceId, dog) => {
      removeFromAll(dog.id);
      setAssignments((prev) => ({
        ...prev,
        [spaceId]: [...prev[spaceId], dog],
      }));
    },
    [removeFromAll]
  );

  const onDragStart = (e, dog) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ dog }));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e, spaceId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setHoverSpace(spaceId);
  };
  const onDropSpace = (e, spaceId) => {
    e.preventDefault();
    setHoverSpace(null);
    try {
      const { dog } = JSON.parse(e.dataTransfer.getData("application/json"));
      if (dog) dropOnSpace(spaceId, dog);
    } catch (error) {
      console.error(error);
    }
  };
  const onDropPool = (e) => {
    e.preventDefault();
    try {
      const { dog } = JSON.parse(e.dataTransfer.getData("application/json"));
      if (dog) dropOnPool(dog);
    } catch (error) {
      console.error(error);
    }
  };

  const clearAll = () => {
    const allDogs = [...pool, ...Object.values(assignments).flat()];
    setAssignments(SPACES.reduce((acc, s) => ({ ...acc, [s.id]: [] }), {}));
    setPool(allDogs);
  };

  // Comentario: grid con filas más altas ⇒ sensación de “más ancho/espacioso”
  const gridStyle = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
      gridAutoRows: "88px", // ↑ antes 72px
      gap: "12px", // ↑ más espacio
    }),
    []
  );

  const SpaceCard = ({ space }) => {
    const dogs = assignments[space.id] || [];
    const isHover = hoverSpace === space.id;
    const color =
      space.type === "patio"
        ? "border-amber-400 bg-amber-50"
        : "border-slate-300 bg-white";

    return (
      <div
        onDragOver={(e) => onDragOver(e, space.id)}
        onDrop={(e) => onDropSpace(e, space.id)}
        style={{
          gridColumn: `${space.c1} / ${space.c2}`,
          gridRow: `${space.r1} / ${space.r2}`,
        }}
        className={`relative rounded-md border ${color} p-3 overflow-auto transition-shadow ${
          isHover ? "ring-2 ring-blue-400" : ""
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold">{space.label}</span>
          <span className="text-[10px] text-gray-500 uppercase">
            {space.type}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {dogs.length === 0 ? (
            <div className="text-[11px] text-gray-400 italic">Vacío</div>
          ) : (
            dogs.map((dog) => (
              <div
                key={dog.id}
                draggable
                onDragStart={(e) => onDragStart(e, dog)}
                className="px-2 py-1 text-xs rounded bg-blue-50 border border-blue-200 cursor-move"
                title={`Arrastra para mover a ${space.label}`}
              >
                {dog.name}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">Mapa de instalaciones</h1>
        <button
          onClick={clearAll}
          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
        >
          Vaciar asignaciones
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <div style={gridStyle}>
            {SPACES.map((s) => (
              <SpaceCard key={s.id} space={s} />
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Arrastra un perro desde cualquier box/patio hasta la lista de la
            derecha para “liberarlo”.
          </p>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropPool}
            className="rounded-md border border-gray-300 bg-white p-3 min-h-[220px]"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Perros sin asignar</h2>
              <span className="text-xs text-gray-500">
                {loading ? "Cargando..." : pool.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {loading ? (
                <div className="text-sm text-gray-400 italic">
                  Cargando perros…
                </div>
              ) : pool.length === 0 ? (
                <div className="text-sm text-gray-400 italic">Sin perros</div>
              ) : (
                pool.map((dog) => (
                  <div
                    key={dog.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, dog)}
                    className="px-2 py-1 text-sm rounded bg-slate-50 border border-slate-200 cursor-move"
                    title="Arrastra a un box o patio"
                  >
                    {dog.name}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
            <h3 className="text-sm font-semibold mb-2">Resumen</h3>
            <ul className="text-sm space-y-1 max-h-64 overflow-auto">
              {SPACES.map((s) => (
                <li key={s.id} className="flex justify-between">
                  <span className="text-gray-600">{s.label}</span>
                  <span className="font-medium">
                    {(assignments[s.id] || []).length}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapaScreen;
