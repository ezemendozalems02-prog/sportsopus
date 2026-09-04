import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";
import { HOME_BY_ROLE, roleCanAccess } from "./permissions";
import type { EmployeeRole } from "./types";

// Cookie/session layer para SportControl.
//
// - Empleados/dueños: Supabase Auth real (auth.users). La sesión vive en las
//   cookies sb-* que setea @supabase/ssr (ver src/lib/supabase/server.ts) —
//   acá solo resolvemos qué fila de `employees` corresponde al usuario
//   autenticado.
// - Superadmin: se deja igual que antes — no es un tenant, no necesita
//   Supabase Auth. Sigue siendo un chequeo contra SUPERADMIN_EMAIL/PASSWORD
//   (env vars) + una cookie propia, para que pueda convivir en el mismo
//   navegador con una sesión de empleado sin pisarse.
// - Clientes invitados: tampoco necesitan Auth — se identifican una vez por
//   email en el paso de confirmación y quedan recordados por cookie.

const SUPERADMIN_COOKIE = "sc_admin_session";
const CUSTOMER_COOKIE = "sc_customer";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 días
};

export async function setEmployeeSession(email: string, password: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Email o contraseña incorrectos");
}

export async function clearEmployeeSession() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
}

export async function getEmployeeSession(): Promise<{ employeeId: string; organizationId: string; role: EmployeeRole } | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: employee } = await supabaseAdmin()
    .from("employees")
    .select("id, organization_id, role")
    .eq("user_id", data.user.id)
    .eq("active", true)
    .maybeSingle();
  if (!employee) return null;

  return { employeeId: employee.id, organizationId: employee.organization_id, role: employee.role as EmployeeRole };
}

// `routeKey` identifica la página que llama (ej. "/admin/caja") para chequear
// contra el mapa de permisos por rol en permissions.ts — si el rol no tiene
// acceso, redirige a su propio home en vez de a esa página. Se omite en
// layouts que envuelven páginas con distintos roles permitidos (el chequeo
// de rol vive en cada página, no en el layout compartido).
export async function requireEmployeeSession(routeKey?: string): Promise<{ employeeId: string; organizationId: string; role: EmployeeRole }> {
  const session = await getEmployeeSession();
  if (!session) redirect("/login");
  if (routeKey && !roleCanAccess(session.role, routeKey)) redirect(HOME_BY_ROLE[session.role]);
  return session;
}

export async function setSuperadminSession(adminId: string) {
  const store = await cookies();
  store.set(SUPERADMIN_COOKIE, adminId, COOKIE_OPTIONS);
}

export async function clearSuperadminSession() {
  const store = await cookies();
  store.delete(SUPERADMIN_COOKIE);
}

export async function getSuperadminSession(): Promise<{ adminId: string } | null> {
  const store = await cookies();
  const adminId = store.get(SUPERADMIN_COOKIE)?.value;
  return adminId ? { adminId } : null;
}

export async function requireSuperadminSession(): Promise<{ adminId: string }> {
  const session = await getSuperadminSession();
  if (!session) redirect("/superadmin/login");
  return session;
}

// El cliente que reserva no tiene login real — se lo identifica por email en
// el paso de confirmación (findOrCreateGuestCustomer en db.ts) y a partir de
// ahí se lo recuerda por organización en una sola cookie (mapa JSON
// { [organizationId]: customerId }), porque la misma persona puede reservar
// en más de un complejo distinto. customerId es directamente el id real de
// la fila en `customers` — no hace falta indirección de token.
async function readCustomerIdMap(): Promise<Record<string, string>> {
  const store = await cookies();
  const raw = store.get(CUSTOMER_COOKIE)?.value;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function getCustomerSession(organizationId: string): Promise<{ customerId: string } | null> {
  const map = await readCustomerIdMap();
  const customerId = map[organizationId];
  return customerId ? { customerId } : null;
}

export async function setCustomerSession(organizationId: string, customerId: string) {
  const map = await readCustomerIdMap();
  map[organizationId] = customerId;
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, JSON.stringify(map), COOKIE_OPTIONS);
}
