// Comentario: Contexto global para auth, precios y cachés ligeras en memoria
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { auth, db } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AppCtx = createContext(null);

export const AppProvider = ({ children }) => {
  // Comentario: auth + rol
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [authReady, setAuthReady] = useState(false);

  // Comentario: precios
  const [prices, setPrices] = useState(null);
  const [pricesReady, setPricesReady] = useState(false);

  // Comentario: cachés de sesión
  const [clientNameCache] = useState(() => new Map()); // id_cliente -> perro_nombre
  const [clientPatioCache] = useState(() => new Map()); // id_cliente -> boolean

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole("user");
        setAuthReady(true);
        return;
      }
      // Comentario: cachear rol en sessionStorage para primer render rápido
      const ssKey = `role:${u.uid}`;
      const cached = sessionStorage.getItem(ssKey);
      if (cached) setRole(cached);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const r = snap.exists() ? snap.data().role || "user" : "user";
        setRole(r);
        sessionStorage.setItem(ssKey, r);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Comentario: precios se cargan una vez
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "prices", "tarifas2"));
        if (alive) setPrices(snap.exists() ? snap.data() : null);
      } finally {
        if (alive) setPricesReady(true);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      authReady,
      prices,
      pricesReady,
      clientNameCache,
      clientPatioCache,
    }),
    [
      user,
      role,
      authReady,
      prices,
      pricesReady,
      clientNameCache,
      clientPatioCache,
    ]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(AppCtx);
