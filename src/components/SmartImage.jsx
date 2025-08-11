// Comentario: imagen con lazy, dimensiones fijas y transform de Cloudinary si aplica
import React, { useMemo } from "react";

const toCloudinaryThumb = (url, w = 96, h = 96) => {
  // Comentario: si ya es Cloudinary, insertamos transformación de thumbnail
  try {
    const u = new URL(url);
    if (u.hostname.includes("res.cloudinary.com")) {
      const parts = u.pathname.split("/upload/");
      if (parts.length === 2) {
        return `${u.origin}${parts[0]}/upload/c_fill,g_auto,f_auto,q_auto,w_${w},h_${h}/${parts[1]}`;
      }
    }
  } catch (error) {
    console.error(error);
  }
  return url;
};

const SmartImage = ({
  src,
  alt,
  width = 48,
  height = 48,
  className = "",
  onClick, // Comentario: permitir click para modales
  ...rest // Comentario: reenviar props extra
}) => {
  const optimized = useMemo(
    () => toCloudinaryThumb(src, width, height),
    [src, width, height]
  );

  const clickable = typeof onClick === "function";

  return (
    <img
      src={optimized}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      referrerPolicy="no-referrer"
      onClick={onClick}
      className={`${className} ${clickable ? "cursor-zoom-in" : ""}`}
      {...(clickable
        ? {
            role: "button",
            tabIndex: 0,
            onKeyDown: (e) => {
              // Comentario: accesible con teclado
              if (e.key === "Enter" || e.key === " ") onClick(e);
            },
          }
        : null)}
      {...rest}
    />
  );
};

export default SmartImage;
