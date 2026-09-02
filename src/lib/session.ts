import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, getSession, type SessionRecord } from "./db";

// Cookie/session layer for SportControl's mock multi-tenant auth. Kept out
// of db.ts because it's the seam between HTTP (cookies) and the in-memory
// store — pages and Server Actions call these, never db.ts's session-store
// primitives directly. Swapping in real Supabase Auth later means replacing
// this file's internals; callers (requireEmployeeSession() etc.) stay the
// same shape.

const EMPLOYEE_COOKIE = "sc_session";
const SUPERADMIN_COOKIE = "sc_admin_session";
const CUSTOMER_COOKIE = "sc_customer";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 días
};

export async function setEmployeeSession(token: string) {
  const store = await cookies();
  store.set(EMPLOYEE_COOKIE, token, COOKIE_OPTIONS);
}

export async function clearEmployeeSession() {
  const store = await cookies();
  const token = store.get(EMPLOYEE_COOKIE)?.value;
  destroySession(token);
  store.delete(EMPLOYEE_COOKIE);
}

export async function getEmployeeSession(): Promise<{ employeeId: string; organizationId: string } | null> {
  const store = await cookies();
  const token = store.get(EMPLOYEE_COOKIE)?.value;
  const record = getSession(token);
  if (!record || record.kind !== "employee") return null;
  return { employeeId: record.employeeId, organizationId: record.organizationId };
}

export async function requireEmployeeSession(): Promise<{ employeeId: string; organizationId: string }> {
  const session = await getEmployeeSession();
  if (!session) redirect("/login");
  return session;
}

export async function setSuperadminSession(token: string) {
  const store = await cookies();
  store.set(SUPERADMIN_COOKIE, token, COOKIE_OPTIONS);
}

export async function clearSuperadminSession() {
  const store = await cookies();
  const token = store.get(SUPERADMIN_COOKIE)?.value;
  destroySession(token);
  store.delete(SUPERADMIN_COOKIE);
}

export async function getSuperadminSession(): Promise<{ adminId: string } | null> {
  const store = await cookies();
  const token = store.get(SUPERADMIN_COOKIE)?.value;
  const record = getSession(token);
  if (!record || record.kind !== "superadmin") return null;
  return { adminId: record.adminId };
}

export async function requireSuperadminSession(): Promise<{ adminId: string }> {
  const session = await getSuperadminSession();
  if (!session) redirect("/superadmin/login");
  return session;
}

// El cliente que reserva no tiene login real — se lo identifica por email en
// el paso de confirmación (findOrCreateGuestCustomer en db.ts) y a partir de
// ahí se lo recuerda por organización en una sola cookie (mapa JSON
// { [organizationId]: token }), porque la misma persona puede reservar en
// más de un complejo distinto.
async function readCustomerTokenMap(): Promise<Record<string, string>> {
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
  const map = await readCustomerTokenMap();
  const token = map[organizationId];
  const record = getSession(token);
  if (!record || record.kind !== "customer") return null;
  return { customerId: record.customerId };
}

export async function setCustomerSession(organizationId: string, token: string) {
  const map = await readCustomerTokenMap();
  map[organizationId] = token;
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, JSON.stringify(map), COOKIE_OPTIONS);
}

export function newSessionToken(record: SessionRecord): string {
  return createSession(record);
}
