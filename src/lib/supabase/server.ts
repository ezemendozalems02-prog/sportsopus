import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente atado a las cookies del request — se usa SOLO para las 3
// operaciones reales de auth de empleados/dueños: signInWithPassword (login),
// getUser() (leer sesión) y signOut() (logout). Es el único lugar donde se
// setean las cookies reales de sesión de Supabase (sb-*). Las queries de
// datos de negocio van todas por supabaseAdmin() (src/lib/supabase/admin.ts).
export async function supabaseServer() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  }
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component (cookies de solo lectura) — el
          // refresh de token real ocurre en src/proxy.ts en ese caso.
        }
      },
    },
  });
}
