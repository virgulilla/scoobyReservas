// components/SwipeItem.jsx
import React, { useRef, useState, useCallback } from "react";

/* 
  Componente reutilizable:
  - Soporta ratón y táctil
  - Detecta dirección predominante y evita disparos con scroll vertical
  - Requiere gesto intencional hacia la derecha
*/
const SwipeItem = ({
  children, // Contenido visual
  onConfirm, // Acción al superar el umbral
  threshold = 80, // Umbral en px
  completed = false, // Estado para estilos externos
  className = "", // Clases extra opcionales
}) => {
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const hasDirection = useRef(null);
  const [translateX, setTranslateX] = useState(0);
  const [animating, setAnimating] = useState(false);

  const isMultiTouch = (e) => "touches" in e && e.touches.length > 1;

  const onStart = useCallback((x, y) => {
    dragging.current = true;
    hasDirection.current = null;
    setAnimating(false);
    startX.current = x;
    startY.current = y;
  }, []);

  const onMove = useCallback(
    (x, y) => {
      if (!dragging.current) return;

      const dx = x - startX.current;
      const dy = y - startY.current;

      if (!hasDirection.current) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx < 6 && absDy < 6) return;
        hasDirection.current = absDy <= 0.577 * absDx ? "h" : "v";
      }

      if (hasDirection.current === "v") return;
      if (dx < 0) return setTranslateX(0);
      setTranslateX(Math.min(dx, threshold * 1.5));
    },
    [threshold]
  );

  const onEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    const shouldConfirm = translateX >= threshold;
    setAnimating(true);

    if (shouldConfirm) {
      setTranslateX(threshold);
      Promise.resolve().then(() => onConfirm());
      setTimeout(() => setTranslateX(0), 150);
    } else {
      setTranslateX(0);
    }
  }, [translateX, threshold, onConfirm]);

  // Ratón
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    onStart(e.clientX, e.clientY);
  };
  const handleMouseMove = (e) => onMove(e.clientX, e.clientY);
  const handleMouseUp = () => onEnd();

  // Táctil
  const handleTouchStart = (e) => {
    if (isMultiTouch(e)) return;
    const t = e.touches[0];
    onStart(t.clientX, t.clientY);
  };
  const handleTouchMove = (e) => {
    if (isMultiTouch(e)) return;
    const t = e.touches[0];
    onMove(t.clientX, t.clientY);
  };
  const handleTouchEnd = () => onEnd();

  return (
    <div
      className={className}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${translateX}px)`,
        transition: animating ? "transform 160ms ease-out" : "none",
        willChange: "transform",
        touchAction: "pan-y",
        userSelect: "none",
        cursor: "grab",
      }}
      role="button"
      aria-label="Desliza a la derecha para completar"
      aria-pressed={completed}
    >
      {children}
    </div>
  );
};

export default SwipeItem;
