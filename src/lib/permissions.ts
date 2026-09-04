import type { EmployeeRole } from "./types";

// Qué puede ver cada rol dentro del panel. El dueño ve todo; el resto se
// reparte entre "configurar el club" (admin) y "cobrar en el mostrador"
// (cajero) — sin métricas de facturación ni gestión de personal para
// ninguno de los dos.
export const ROUTE_ROLES: Record<string, EmployeeRole[]> = {
  "/admin": ["owner"],
  "/admin/agenda": ["owner", "cajero"],
  "/admin/canchas": ["owner", "admin"],
  "/admin/clientes": ["owner", "admin"],
  "/admin/caja": ["owner", "cajero"],
  "/admin/inventario": ["owner", "admin"],
  "/admin/gastos": ["owner", "admin"],
  "/admin/empleados": ["owner"],
  "/admin/auditoria": ["owner"],
  "/admin/torneos": ["owner", "admin"],
  "/admin/ranking": ["owner", "admin"],
  "/admin/promociones": ["owner", "admin"],
  "/admin/notificaciones": ["owner", "admin"],
  "/admin/analitica": ["owner"],
  "/admin/alertas": ["owner"],
  "/admin/reportes": ["owner"],
  "/admin/plan": ["owner"],
};

// A dónde va cada rol si intenta entrar a una página que no le corresponde
// (o al loguearse): el dueño al dashboard, el admin a canchas, el cajero
// directo a la agenda para empezar a cobrar.
export const HOME_BY_ROLE: Record<EmployeeRole, string> = {
  owner: "/admin",
  admin: "/admin/canchas",
  cajero: "/admin/agenda",
};

export function roleCanAccess(role: EmployeeRole, routeKey: string): boolean {
  const allowed = ROUTE_ROLES[routeKey];
  return !allowed || allowed.includes(role);
}
