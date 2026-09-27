"use client";

import { createContext, useContext } from "react";

// Rol de la sesion ("admin" | "client") disponible en todas las paginas.
const RoleContext = createContext(null);

export function RoleProvider({ role, children }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}

/** Aviso de conexion faltante: la agencia ve el boton, el cliente un mensaje. */
export function ConnectionHint({ className = "btn btn-tiendanube" }) {
  const role = useRole();
  if (role !== "admin") {
    return <p className="muted small" style={{ margin: 0 }}>Avisale a la agencia para que lo revise.</p>;
  }
  return (
    <a href="/dashboard/conexiones" className={className}>
      Ir a Conexiones
    </a>
  );
}
