import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente con la service role key — bypasea RLS a propósito. Es el que usa
// TODA la capa de datos de db.ts (no solo el superadmin): esta app nunca
// llama a Supabase directo desde el browser, así que el límite de confianza
// real ya es el server de Next, no RLS. Cada función de db.ts sigue
// filtrando explícitamente por organizationId, igual que hacía con los
// arrays en memoria — ver el comentario en 0001_init.sql / 0005_multitenant_auth.sql.
let client: SupabaseClient | undefined;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }
  client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}
