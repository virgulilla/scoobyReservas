// Comentario: Encuesta de verano centrada en perros. Ranking oculto hasta que voten 3 participantes.
// - Cada participante debe emitir 3 votos por categoría para considerarse "completado".
// - El ranking y el dado sólo se muestran cuando los 3 han completado.
// - Búsqueda y casting de votos igual que antes.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  startAt,
  endAt,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/config";

// Comentario: categorías sobre perros
const CATEGORIES = [
  { id: "mas_guapo", label: "El más guapo" },
  { id: "mas_feo", label: "El más feo (adorable)" },
  { id: "mas_pesado", label: "El más pesado" },
  { id: "mas_tranquilo", label: "El más tranquilo" },
  { id: "mas_sociable", label: "El más sociable" },
  { id: "mas_comilon", label: "El más comilón" },
  { id: "mas_escurridizo", label: "El más escapista/escurridizo" },
  { id: "mas_dormilon", label: "El más dormilón" },
];

// Comentario: configuración de votación
const VOTES_PER_CATEGORY = 3;
const TOTAL_PARTICIPANTS = 3;
const LS_VOTER_KEY = "encuesta_votante_alias_2025";
const VOTES_COLL = "encuesta_verano_votos_2025";

const EncuestaScreen = () => {
  const [voter, setVoter] = useState(
    () => window.localStorage.getItem(LS_VOTER_KEY) || ""
  );
  const [activeCat, setActiveCat] = useState(CATEGORIES[0].id);
  const [votes, setVotes] = useState([]);
  const [loadingVotes, setLoadingVotes] = useState(true);

  // Comentario: búsqueda tipo Morosos
  const [searchTerm, setSearchTerm] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (voter && voter.trim()) {
      window.localStorage.setItem(LS_VOTER_KEY, voter.trim());
    }
  }, [voter]);

  useEffect(() => {
    const qRef = query(collection(db, VOTES_COLL));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setVotes(list);
        setLoadingVotes(false);
      },
      () => setLoadingVotes(false)
    );
    return () => unsub();
  }, []);

  // Comentario: votos del votante por categoría
  const myVotesByCat = useMemo(() => {
    const map = new Map(CATEGORIES.map((c) => [c.id, 0]));
    for (const v of votes) {
      if (v.voter && voter && v.voter.toLowerCase() === voter.toLowerCase()) {
        map.set(v.category, (map.get(v.category) || 0) + 1);
      }
    }
    return map;
  }, [votes, voter]);
  const remaining = Math.max(
    0,
    VOTES_PER_CATEGORY - (myVotesByCat.get(activeCat) || 0)
  );

  // Comentario: ranking por categoría
  const rankingByCat = useMemo(() => {
    const perCat = new Map(CATEGORIES.map((c) => [c.id, new Map()]));
    for (const v of votes) {
      const catMap = perCat.get(v.category);
      if (!catMap) continue;
      const prev = catMap.get(v.clientId) || {
        count: 0,
        clientId: v.clientId,
        perroNombre: v.perroNombre || "",
        clienteNombre: v.clienteNombre || "",
        telefono: v.telefono || "",
        foto_url: v.foto_url || "",
      };
      prev.count += 1;
      catMap.set(v.clientId, prev);
    }
    const out = {};
    for (const c of CATEGORIES) {
      out[c.id] = Array.from(perCat.get(c.id).values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.perroNombre || "")
          .toLowerCase()
          .localeCompare(String(b.perroNombre || "").toLowerCase(), "es", {
            sensitivity: "base",
          });
      });
    }
    return out;
  }, [votes]);

  // Comentario: participantes y condición de visibilidad del ranking
  const { distinctVoters, completedVotersCount, showResults } = useMemo(() => {
    // Mapa: voter -> categoría -> count
    const matrix = new Map();
    for (const v of votes) {
      const key = (v.voter || "").trim().toLowerCase();
      if (!key) continue;
      if (!matrix.has(key))
        matrix.set(key, new Map(CATEGORIES.map((c) => [c.id, 0])));
      const perCat = matrix.get(key);
      perCat.set(v.category, (perCat.get(v.category) || 0) + 1);
    }

    const votersKeys = Array.from(matrix.keys());
    let completed = 0;
    for (const k of votersKeys) {
      const perCat = matrix.get(k);
      // Un participante se considera "completado" si tiene >= VOTES_PER_CATEGORY en TODAS las categorías
      const allCatsDone = CATEGORIES.every(
        (c) => (perCat.get(c.id) || 0) >= VOTES_PER_CATEGORY
      );
      if (allCatsDone) completed += 1;
    }

    return {
      distinctVoters: votersKeys.length,
      completedVotersCount: completed,
      showResults: completed >= TOTAL_PARTICIPANTS,
    };
  }, [votes]);

  // Comentario: búsqueda con dos índices y filtro en memoria
  const runSearch = async (term) => {
    const t = term.trim();
    const tLower = t.toLowerCase();
    if (tLower.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const resultsMap = new Map();

      const q1 = query(
        collection(db, "clients"),
        orderBy("perro_nombre"),
        startAt(tLower),
        endAt(tLower + "\uf8ff"),
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

      const q2 = query(
        collection(db, "clients"),
        orderBy("telefono"),
        startAt(t),
        endAt(t + "\uf8ff"),
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

      let combined = Array.from(resultsMap.values()).filter((c) => {
        const dog = String(c.perro_nombre || "").toLowerCase();
        const owner = String(c["dueño_nombre"] || "").toLowerCase();
        const phone = String(c.telefono || "");
        return (
          dog.includes(tLower) || owner.includes(tLower) || phone.includes(t)
        );
      });

      combined.sort((a, b) =>
        String(a.perro_nombre || "")
          .toLowerCase()
          .localeCompare(String(b.perro_nombre || "").toLowerCase(), "es", {
            sensitivity: "base",
          })
      );

      setSearchResults(combined);
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
    return () => debounceRef.current && clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const castVote = async (client) => {
    if (!voter.trim()) return;
    if (remaining <= 0) return;
    try {
      await addDoc(collection(db, VOTES_COLL), {
        voter: voter.trim(),
        category: activeCat,
        clientId: client.id,
        perroNombre: client.perro_nombre || "",
        clienteNombre: client["dueño_nombre"] || "",
        telefono: client.telefono || "",
        foto_url: client.foto_url || "",
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error añadiendo voto:", err);
    }
  };

  // Comentario: dado para desempate solo cuando showResults === true
  const [winnerRoll, setWinnerRoll] = useState(null);
  const rollTieBreaker = () => {
    if (!showResults) return;
    const table = rankingByCat[activeCat] || [];
    if (table.length === 0) {
      setWinnerRoll({ winner: null, note: "Sin votos" });
      return;
    }
    const topScore = table[0].count;
    const tied = table.filter((r) => r.count === topScore);
    if (tied.length === 1) {
      setWinnerRoll({ winner: tied[0], note: "Ganador sin empate" });
      return;
    }
    const bytes = new Uint32Array(1);
    window.crypto.getRandomValues(bytes);
    const idx = bytes[0] % tied.length;
    setWinnerRoll({
      winner: tied[idx],
      note: `Empate entre ${tied.length}. Dado → índice ${idx + 1}/${
        tied.length
      }`,
    });
  };

  return (
    <div className="p-4 pb-24 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Encuesta de verano 🗳️</h1>

      {/* Comentario: alias del votante */}
      <div className="bg-white rounded shadow p-4 mb-4">
        <label className="block text-sm font-medium mb-1">
          Identifícate para votar
        </label>
        <input
          type="text"
          value={voter}
          onChange={(e) => setVoter(e.target.value)}
          placeholder="Ej. Laura · Turno tarde"
          className="w-full border rounded p-2"
        />
        <p className="text-xs text-gray-500 mt-1">
          Límite: {VOTES_PER_CATEGORY} votos por categoría y persona.
        </p>
      </div>

      {/* Comentario: selector de categoría */}
      <div className="flex gap-2 overflow-x-auto mb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`px-3 py-1 rounded border whitespace-nowrap ${
              c.id === activeCat
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-800 border-gray-300"
            }`}
          >
            {c.label}
            <span
              className={`ml-2 text-xs ${
                c.id === activeCat ? "text-indigo-100" : "text-gray-500"
              }`}
            >
              {VOTES_PER_CATEGORY - (myVotesByCat.get(c.id) || 0)}/
              {VOTES_PER_CATEGORY}
            </span>
          </button>
        ))}
      </div>

      {/* Comentario: búsqueda y voto */}
      <div className="bg-white rounded shadow p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            Vota en “{CATEGORIES.find((c) => c.id === activeCat)?.label}”
          </h2>
          <span className="text-sm">
            Restantes:{" "}
            <strong className={remaining === 0 ? "text-red-600" : ""}>
              {remaining}
            </strong>
            /{VOTES_PER_CATEGORY}
          </span>
        </div>

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
          <div className="border rounded max-h-64 overflow-auto">
            {searchResults.map((c) => (
              <div
                key={c.id}
                className="w-full px-3 py-2 flex items-center gap-3 border-b last:border-b-0"
              >
                {c.foto_url ? (
                  <img
                    src={c.foto_url}
                    alt={c.perro_nombre}
                    className="w-10 h-10 rounded-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                    Sin foto
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-medium">{c.perro_nombre}</div>
                  <div className="text-xs text-gray-600">
                    {c["dueño_nombre"]} · 📞 {c.telefono || "—"}
                  </div>
                </div>
                <button
                  disabled={!voter.trim() || remaining <= 0}
                  onClick={() => castVote(c)}
                  className="text-sm px-3 py-1 rounded border border-indigo-600 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                >
                  Votar
                </button>
              </div>
            ))}
          </div>
        )}

        {!searchResults.length && !searchLoading && searchTerm.trim() ? (
          <div className="text-sm text-gray-500 mt-2">
            Sin resultados para “{searchTerm.trim()}”.
          </div>
        ) : null}
      </div>

      {/* Comentario: estado de resultados ocultos y progreso de participantes */}
      {!showResults ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-6 text-sm text-yellow-900">
          Resultados ocultos hasta que terminen {TOTAL_PARTICIPANTS}{" "}
          participantes.
          <div className="mt-1 text-xs text-yellow-800">
            Participantes distintos: {distinctVoters} · Completados:{" "}
            {completedVotersCount}/{TOTAL_PARTICIPANTS}
          </div>
          <div className="text-xs text-yellow-700 mt-1">
            Un participante se considera completado cuando registra{" "}
            {VOTES_PER_CATEGORY} votos en cada categoría.
          </div>
        </div>
      ) : null}

      {/* Comentario: ranking visible sólo cuando showResults === true */}
      {showResults && (
        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Ranking actual</h2>
            <button
              onClick={rollTieBreaker}
              className="text-sm px-3 py-1 rounded border border-gray-400 hover:bg-gray-50"
            >
              Resolver empate (dado)
            </button>
          </div>

          {loadingVotes ? (
            <div className="text-gray-500">Cargando votos…</div>
          ) : (rankingByCat[activeCat] || []).length === 0 ? (
            <div className="text-gray-500">Aún no hay votos.</div>
          ) : (
            <ul className="divide-y">
              {(rankingByCat[activeCat] || []).map((r, idx) => (
                <li key={r.clientId} className="py-2 flex items-center gap-3">
                  {r.foto_url ? (
                    <img
                      src={r.foto_url}
                      alt={r.perroNombre}
                      className="w-8 h-8 rounded-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500">
                      Sin
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium">
                      {idx + 1}. {r.perroNombre}
                    </div>
                    <div className="text-xs text-gray-600">
                      {r.clienteNombre} · 📞 {r.telefono || "—"}
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{r.count}</span>
                </li>
              ))}
            </ul>
          )}

          {winnerRoll ? (
            <div className="mt-3 p-2 border rounded bg-gray-50">
              <div className="text-sm text-gray-700">
                {winnerRoll.winner ? (
                  <>
                    Ganador provisional:{" "}
                    <strong>{winnerRoll.winner.perroNombre}</strong> · votos:{" "}
                    <strong>{winnerRoll.winner.count}</strong>
                    <div className="text-xs text-gray-600">
                      {winnerRoll.note}
                    </div>
                  </>
                ) : (
                  <>{winnerRoll.note}</>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="text-xs text-gray-600">
        Reglas: {VOTES_PER_CATEGORY} votos por persona y categoría. El ranking
        permanece oculto hasta que
        {` ${TOTAL_PARTICIPANTS} `}participantes completen sus votos en todas
        las categorías.
      </div>
    </div>
  );
};

export default EncuestaScreen;
