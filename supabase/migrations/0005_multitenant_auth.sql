-- SportControl — multicuenta real: cada organización queda completamente
-- aislada, con su propio dueño/empleados y su propio link de reserva
-- público. La mayor parte del modelo multi-tenant ya existía desde
-- 0001_init.sql (organization_id + RLS en cada tabla) — lo único nuevo acá
-- es el concepto de "superadmin" (dueño de la plataforma SportControl, no
-- de un complejo), que no encaja dentro de organization_id porque
-- deliberadamente ve todos los tenants a la vez.

create table platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create or replace function is_platform_admin() returns boolean as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$ language sql stable security definer;

-- Nota sobre cómo el panel /superadmin debería consultar datos reales: NO
-- se agregan políticas de RLS que le den a un platform_admin acceso de
-- lectura cross-tenant a organizations/bookings/etc. — eso requeriría una
-- política "bypass" en cada tabla, lo cual es fácil de olvidar y fácil de
-- explotar por error. El patrón estándar (y el que usa este proyecto) es que
-- el código del panel superadmin corra en el servidor con
-- SUPABASE_SERVICE_ROLE_KEY (ya está en .env.example, sin usar todavía),
-- que ignora RLS por completo, después de verificar is_platform_admin()
-- para el usuario logueado a nivel de aplicación.

-- Nota sobre el registro real (`/registro` creando una organización nueva):
-- ya lo señalaba el comentario de 0004_saas.sql — hace falta un flujo
-- server-side con la service role key. En concreto, al conectar Supabase
-- Auth de verdad, `signupAction` en src/lib/actions.ts pasa a:
--   1) supabase.auth.admin.createUser({ email, password })
--   2) insert en organizations (nombre, slug único, plan, trialing)
--   3) insert en employees con role='owner' y el user_id recién creado
-- Las tres operaciones deberían ir en una transacción/función RPC para no
-- dejar una organización sin dueño si el paso 3 falla.

-- Sin cambios de schema para:
--   - Contraseñas: no existen en el modelo real, Supabase Auth las maneja
--     por completo (el campo `password` de Employee en el mock desaparece).
--   - Clientes invitados (reservan sin cuenta): `customers.user_id` ya es
--     nullable desde 0001_init.sql, que es exactamente esa forma.
--   - Alta de canchas desde el panel: la política "org scoped access" de
--     0001_init.sql ya permite insertar a cualquier empleado de esa
--     organización — es un gap de UI (ya cerrado en el código), no de RLS.
