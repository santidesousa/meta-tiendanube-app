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
  // El cliente solo ve el mensaje generico; la agencia, el acceso a Conexiones.
  if (role !== "admin") return null;
  return (
    <a href="/dashboard/conexiones" className={className}>
      Ir a Conexiones
    </a>
  );
}
