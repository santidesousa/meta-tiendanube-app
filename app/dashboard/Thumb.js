"use client";

/** Miniatura de producto/creatividad; si no hay imagen muestra la inicial. */
export default function Thumb({ src, alt, size = 44 }) {
  if (!src) {
    return (
      <div className="thumb thumb-empty" style={{ width: size, height: size }}>
        {(alt || "?").slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return <img className="thumb" src={src} alt={alt} style={{ width: size, height: size }} loading="lazy" />;
}
