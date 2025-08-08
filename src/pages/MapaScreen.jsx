// Comentario: Mapa con DnD táctil (dnd-kit), persistencia diaria (cookie + localStorage) y modal.
// Comentario: Los perros se cargan desde Firestore y empiezan en P4 si no hay estado guardado.

import React, { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { db } from "../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

// -------------------- util fecha --------------------
// Comentario: clave yyyy-mm-dd para la persistencia diaria
const todayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// -------------------- helpers cookies & storage --------------------
// Comentario: cookie pequeña que solo guarda la clave del día; expira a las 23:59:59
const setTodayCookieFlag = (name, value) => {
  const expires = new Date();
  expires.setHours(23, 59, 59, 999);
  document.cookie = `${name}=${encodeURIComponent(
    value
  )};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};
const getCookie = (name) => {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
};

// Comentario: usamos localStorage para el payload grande (sin límite 4KB)
const STORAGE_PREFIX = "dogAssignments:";
const saveStateToStorage = (dayKey, state) => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${dayKey}`, JSON.stringify(state));
  } catch (e) {
    console.warn("No se pudo guardar en localStorage:", e);
  }
};
const loadStateFromStorage = (dayKey) => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${dayKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// -------------------- layout --------------------
// Comentario: Grid de 12 columnas, filas altas para legibilidad
const SPACES = [
  // Patios
  { id: "P5", label: "P5", type: "patio", c1: 1, c2: 9, r1: 6, r2: 12 },
  { id: "P4", label: "P4", type: "patio", c1: 1, c2: 9, r1: 7, r2: 12 }, // patio grande inferior izq
  { id: "P1", label: "P1", type: "patio", c1: 9, c2: 12, r1: 7, r2: 10 },
  { id: "P2", label: "P2", type: "patio", c1: 9, c2: 12, r1: 9, r2: 11 },
  { id: "P3", label: "P3", type: "patio", c1: 9, c2: 12, r1: 10, r2: 12 },

  // Bloque superior (4 filas)
  // Fila 1
  { id: "B9", label: "B9", type: "box", c1: 2, c2: 4, r1: 1, r2: 2 },
  { id: "B10", label: "B10", type: "box", c1: 4, c2: 6, r1: 1, r2: 2 },
  { id: "B17", label: "B17", type: "box", c1: 7, c2: 9, r1: 1, r2: 2 },
  { id: "B18", label: "B18", type: "box", c1: 9, c2: 11, r1: 1, r2: 3 }, // doble alto

  // Fila 2
  { id: "B8", label: "B8", type: "box", c1: 2, c2: 4, r1: 2, r2: 3 },
  { id: "B11", label: "B11", type: "box", c1: 4, c2: 6, r1: 2, r2: 3 },
  { id: "B16", label: "B16", type: "box", c1: 7, c2: 9, r1: 2, r2: 3 },

  // Fila 3
  { id: "B7", label: "B7", type: "box", c1: 2, c2: 4, r1: 3, r2: 4 },
  { id: "B12", label: "B12", type: "box", c1: 4, c2: 6, r1: 3, r2: 4 },
  { id: "B15", label: "B15", type: "box", c1: 7, c2: 9, r1: 3, r2: 4 },
  { id: "B19", label: "B19", type: "box", c1: 9, c2: 11, r1: 3, r2: 5 }, // doble alto

  // Fila 4
  { id: "B6", label: "B6", type: "peque", c1: 2, c2: 4, r1: 4, r2: 5 }, // medio ancho visual
  { id: "B13", label: "B13", type: "box", c1: 4, c2: 6, r1: 4, r2: 5 },
  { id: "B14", label: "B14", type: "box", c1: 7, c2: 9, r1: 4, r2: 5 },

  // Fila 5 en blanco

  // Fila 6 (B1..B5)
  { id: "B1", label: "B1", type: "box", c1: 2, c2: 4, r1: 5, r2: 6 },
  { id: "B2", label: "B2", type: "box", c1: 4, c2: 6, r1: 5, r2: 6 },
  { id: "B3", label: "B3", type: "box", c1: 6, c2: 8, r1: 5, r2: 6 },
  { id: "B4", label: "B4", type: "box", c1: 8, c2: 10, r1: 5, r2: 6 },
  { id: "B5", label: "B5", type: "motor", c1: 10, c2: 12, r1: 5, r2: 6 },
];

// -------------------- componentes DnD --------------------
const DraggableDog = ({ dog }) => {
  // Comentario: tarjeta arrastrable con tipografía más grande
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: dog.id, data: { dog } });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`px-3 py-1.5 text-sm rounded border cursor-move select-none ${
        isDragging
          ? "bg-blue-100 border-blue-300"
          : "bg-blue-50 border-blue-200"
      }`}
      title={dog.name}
    >
      {dog.name}
    </div>
  );
};

const DroppableSpace = ({ space, children, onOpen }) => {
  // Comentario: contenedor droppable con apertura de modal al pulsar el encabezado
  const { setNodeRef, isOver } = useDroppable({
    id: space.id,
    data: { space },
  });

  const color =
    space.type === "patio"
      ? "border-amber-400 bg-amber-50"
      : "border-slate-300 bg-white";

  return (
    <div
      ref={setNodeRef}
      style={{
        gridColumn: `${space.c1} / ${space.c2}`,
        gridRow: `${space.r1} / ${space.r2}`,
      }}
      className={`relative rounded-md border ${color} p-3 overflow-auto transition-shadow ${
        isOver ? "ring-2 ring-blue-400" : ""
      }`}
    >
      <div
        className="flex items-center justify-between mb-3 cursor-pointer"
        onClick={onOpen}
      >
        <span className="text-sm font-semibold">{space.label}</span>
        <span className="text-[10px] text-gray-500 uppercase">
          {space.type}
        </span>
      </div>
      {children}
    </div>
  );
};

// -------------------- modal simple --------------------
const SpaceModal = ({ open, onClose, title, dogs }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* panel */}
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-lg sm:shadow-lg p-4 max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {dogs?.length ? (
          <ul className="divide-y">
            {dogs.map((d) => (
              <li key={d.id} className="py-2 text-base">
                {d.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Vacío</p>
        )}
      </div>
    </div>
  );
};

// -------------------- main --------------------
const MapaScreen = () => {
  const [assignments, setAssignments] = useState(() =>
    SPACES.reduce((acc, s) => ({ ...acc, [s.id]: [] }), {})
  );
  const [dogToSpace, setDogToSpace] = useState({}); // Comentario: índice inverso dogId -> spaceId
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSpaceId, setModalSpaceId] = useState(null);

  // Sensores: ratón + táctil
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  // Carga inicial con restauración diaria
  useEffect(() => {
    const dayKey = todayKey();
    const flag = getCookie("dogAssignmentsDay");

    if (flag === dayKey) {
      const saved = loadStateFromStorage(dayKey);
      if (saved?.assignments && saved?.dogToSpace) {
        setAssignments(saved.assignments);
        setDogToSpace(saved.dogToSpace);
        setLoading(false);
        return;
      }
    }

    // Si no hay guardado válido, cargamos de Firestore y enviamos todo a P4
    const fetchDogs = async () => {
      setLoading(true);
      try {
        const today = dayKey;
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

        const base = SPACES.reduce((acc, s) => ({ ...acc, [s.id]: [] }), {});
        base["P4"] = dogs;
        const mapping = dogs.reduce((acc, d) => ({ ...acc, [d.id]: "P4" }), {});

        setAssignments(base);
        setDogToSpace(mapping);

        // Persistimos en storage + cookie-flag del día
        saveStateToStorage(dayKey, { assignments: base, dogToSpace: mapping });
        setTodayCookieFlag("dogAssignmentsDay", dayKey);
      } catch (e) {
        console.error("Error cargando perros:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchDogs();
  }, []);

  // Guardado defensivo en storage ante cualquier cambio (cookie ya existe)
  useEffect(() => {
    if (!loading) {
      const dayKey = todayKey();
      saveStateToStorage(dayKey, { assignments, dogToSpace });
      // Aseguramos cookie-flag si faltara (no pesa)
      if (getCookie("dogAssignmentsDay") !== dayKey) {
        setTodayCookieFlag("dogAssignmentsDay", dayKey);
      }
    }
  }, [assignments, dogToSpace, loading]);

  // Mover perro entre espacios
  const moveDog = useCallback(
    (dogId, toSpaceId) => {
      setAssignments((prev) => {
        const fromSpace = dogToSpace[dogId];
        if (!toSpaceId || fromSpace === toSpaceId) return prev;

        // Buscar el perro en el espacio origen
        const dog = (prev[fromSpace] || []).find((d) => d.id === dogId);
        if (!dog) return prev;

        const next = { ...prev };
        next[fromSpace] = next[fromSpace].filter((d) => d.id !== dogId);
        next[toSpaceId] = [...(next[toSpaceId] || []), dog];

        // Persistencia inmediata
        const updatedMap = { ...dogToSpace, [dogId]: toSpaceId };
        const dayKey = todayKey();
        saveStateToStorage(dayKey, {
          assignments: next,
          dogToSpace: updatedMap,
        });
        if (getCookie("dogAssignmentsDay") !== dayKey) {
          setTodayCookieFlag("dogAssignmentsDay", dayKey);
        }

        // Actualizamos índice inverso
        setDogToSpace(updatedMap);
        return next;
      });
    },
    [dogToSpace]
  );

  // Evento DnD
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const dogId = active?.id;
    const toSpaceId = over?.id;
    if (dogId && toSpaceId) moveDog(dogId, toSpaceId);
  };

  // Modal
  const openSpaceModal = (spaceId) => {
    setModalSpaceId(spaceId);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setModalSpaceId(null);
  };
  const currentSpaceDogs = modalSpaceId ? assignments[modalSpaceId] || [] : [];

  // Restablecer: todo a P4
  const resetToP4 = () => {
    const allDogs = Object.values(assignments).flat();
    const base = SPACES.reduce((acc, s) => ({ ...acc, [s.id]: [] }), {});
    base["P4"] = allDogs;
    const mapping = allDogs.reduce((acc, d) => ({ ...acc, [d.id]: "P4" }), {});
    setAssignments(base);
    setDogToSpace(mapping);

    const dayKey = todayKey();
    saveStateToStorage(dayKey, { assignments: base, dogToSpace: mapping });
    if (getCookie("dogAssignmentsDay") !== dayKey) {
      setTodayCookieFlag("dogAssignmentsDay", dayKey);
    }
  };

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">Mapa de instalaciones</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToP4}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
          >
            Restablecer
          </button>
          {loading && (
            <span className="text-sm text-gray-500">Cargando...</span>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                gridAutoRows: "120px",
                gap: "14px",
              }}
            >
              {SPACES.map((space) => (
                <DroppableSpace
                  key={space.id}
                  space={space}
                  onOpen={() => openSpaceModal(space.id)}
                >
                  <div className="flex flex-wrap gap-2">
                    {(assignments[space.id] || []).length === 0 ? (
                      <div className="text-[12px] text-gray-400 italic">
                        Vacío
                      </div>
                    ) : (
                      assignments[space.id].map((dog) => (
                        <DraggableDog key={dog.id} dog={dog} />
                      ))
                    )}
                  </div>
                </DroppableSpace>
              ))}
            </div>

            <p className="mt-2 text-xs text-gray-500">
              Arrastra una tarjeta (o tóquela y arrástrela) hacia un box/patio.
              Todos comienzan en P4.
            </p>
          </div>
        </div>
      </DndContext>

      {/* Modal de contenido del espacio */}
      <SpaceModal
        open={modalOpen}
        onClose={closeModal}
        title={modalSpaceId ? `Contenido de ${modalSpaceId}` : ""}
        dogs={currentSpaceDogs}
      />
    </div>
  );
};

export default MapaScreen;
