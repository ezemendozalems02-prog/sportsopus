# SportControl

ERP + reservas + caja + clientes + torneos + métricas para complejos deportivos (pádel, fútbol, o ambos). Ver el concepto completo discutido en la conversación que originó este repo.

## Estado actual: Fases 1-4 + SaaS multicuenta real (registro, login, panel superadmin) — conectado a Supabase real

Lo que ya funciona, sobre una base Postgres real en Supabase (`src/lib/db.ts` consulta la base — ya no hay datos en memoria):

**Fase 1 — Core**
- Estructura multi-tenant (`organizationId` en cada entidad) para un complejo de ejemplo, "Sport Club Palermo", con 4 canchas de pádel, 2 de fútbol 5 y 1 de fútbol 8.
- Precios dinámicos por horario (hora valle / normal / pico / fin de semana) — `src/lib/pricing.ts`.
- Disponibilidad de turnos por cancha y fecha — `src/lib/availability.ts`.
- Flujo de reserva del cliente con seña (30%) y checkout simulado de Mercado Pago — `/reservar`.
- Historial de reservas del cliente — `/mis-reservas`.
- Dashboard, agenda operativa (cobro de saldo, cambios de estado), canchas y CRM básico de clientes — `/admin`.

**Fase 2 — Operación**
- Caja/POS: apertura y cierre de caja con arqueo (esperado vs. contado), venta de productos que descuenta stock y genera movimientos de caja — `/admin/caja`.
- Inventario: productos con costo/precio/margen por categoría, alerta de stock bajo, reposición manual — `/admin/inventario`.
- Gastos: carga de gastos por categoría, total y desglose del mes — `/admin/gastos`.
- Empleados: alta de empleados y cambio de rol (owner/admin/cajero) — `/admin/empleados`. Los permisos por rol todavía no se aplican en la UI (falta Supabase Auth).
- Auditoría: registro de quién hizo qué (ventas, cobros, cancelaciones, aperturas/cierres de caja, cambios de stock y de rol) — `/admin/auditoria`.
- El dashboard ya suma ingresos de canchas + productos, y avisa de stock bajo y reservas pendientes de pago.

**Fase 3 — Crecimiento**
- Torneos: creación, inscripción de equipos, cuadro de eliminación directa generado automáticamente (con byes si no es potencia de 2), carga de resultados que hace avanzar al ganador — `/admin/torneos` (gestión) y `/torneos` (inscripción del cliente).
- Ranking: se recalcula solo a partir de los resultados de torneos cargados (100 pts por victoria, 400 por ganar la final) — `/admin/ranking`.
- Fidelización: los clientes suman 10 puntos por cada $1.000 pagado en reservas y pueden canjearlos por beneficios — `/beneficios` (cliente).
- Promociones: reglas tipo "Happy Hour" (% off por día/horario/deporte) que se aplican solas al precio al reservar — `/admin/promociones`.
- Lista de espera: si un horario está ocupado, el cliente puede pedir que le avisen; al cancelarse esa reserva se les notifica automáticamente — botón "Avisarme" en `/reservar`, visible en `/mis-reservas`.
- Reservas recurrentes: al confirmar una reserva, el cliente puede repetirla semanalmente (4/8/12 semanas) en un solo pago de seña por turno — selector en el checkout.
- Notificaciones: registro de lo que se le "enviaría" a cada cliente por WhatsApp (confirmación, cancelación, lista de espera, inscripción a torneo) — simulado, no hay una cuenta de WhatsApp Business conectada — `/admin/notificaciones`.

**Fase 4 — Inteligencia**
- Analítica (`/admin/analitica`): facturación de los últimos 14 días, rentabilidad por cancha (% vs. la que más factura), horarios más rentables, ingresos por categoría y por método de pago, todo calculado sobre 35 días de historial de reservas + 21 de caja sembrados para esto.
- Predicción de demanda / recomendación de precios: detecta combinaciones cancha+día+franja horaria con ocupación histórica baja y arma un link directo a "Crear promoción" con esos datos precargados; también señala el horario de mayor demanda para no tocarle el precio.
- Alertas (`/admin/alertas`): junta en un solo lugar reservas de hoy sin seña, stock bajo, diferencias de caja al cierre, y las mismas recomendaciones de baja demanda.
- Reportes automáticos (`/admin/reportes`): resumen de un período (7 o 30 días) con ingresos/gastos/resultado, ocupación promedio, top canchas, top clientes y productos más vendidos — pensado para exportar/imprimir desde el navegador.

No requirió tablas nuevas en Supabase: todo Fase 4 son vistas derivadas de los datos que ya generan las Fases 1-3.

**SaaS — multicuenta real, planes, prueba gratis y panel superadmin**
- Página de precios pública (`/planes`) con los 3 planes: **Starter USD 27**, **Pro USD 57**, **Business USD 97**/mes. Cada uno desbloquea más del panel: Starter solo el core (dashboard, agenda, canchas, clientes), Pro suma Operación (caja, inventario, gastos, empleados, auditoría), Business suma Crecimiento e Inteligencia (torneos, ranking, promociones, notificaciones, analítica, alertas, reportes).
- **Registro real (`/registro`)**: cada alta crea una organización nueva y aislada — nombre, canchas, reservas, empleados, todo separado del resto — con 7 días de prueba gratis, más un empleado dueño con email/contraseña propios. Ya no reutiliza ninguna cuenta de ejemplo.
- **Login (`/login`)** para dueños/empleados existentes, contra Supabase Auth real (ver "Cómo funciona la sesión" abajo). El panel `/admin` completo pasa a requerir sesión: sin ella, redirige a `/login`.
- **Link de reserva propio por complejo**: cada organización tiene su propia app pública en `/{slug-del-complejo}/reservar` (más `/mis-reservas`, `/torneos`, `/beneficios` bajo el mismo slug) — es el link que un dueño comparte con sus clientes, y solo muestra las canchas y reservas de ese complejo. Un cliente que reserva se identifica con nombre/email/teléfono la primera vez (sin contraseña) y queda recordado por cookie para sus próximas visitas a ese mismo complejo.
- **Panel superadmin (`/superadmin`)**: login propio (`/superadmin/login`), separado de las cuentas de los dueños de cancha. Dashboard con total de organizaciones, MRR estimado, distribución de planes y prueba gratis por vencer; listado completo de organizaciones (`/superadmin/organizaciones`) y el detalle de cada una con sus empleados, canchas, reservas y facturación, más acciones para cambiarle el plan o el estado de la suscripción sin pasar por esa cuenta.
- Gestión de la propia suscripción (`/admin/plan`): plan actual, días de prueba restantes, cambio de plan, "activar" la suscripción (pago simulado, siempre aprobado), cancelar, historial de facturación, botón de solo-demo para simular que la prueba venció.
- El panel bloquea de verdad las secciones que no correspondan al plan y muestra un paywall si la prueba venció o la suscripción está cancelada — y ahora **si sí** hace cumplir el acceso contra manipulación del cliente, porque cada request al panel resuelve la organización desde la sesión de servidor, no desde algo que el cliente pueda falsear.
- Precio de referencia en USD como se pidió; Mercado Pago Suscripciones cobra en la moneda de la cuenta MP (normalmente ARS) — `src/lib/db.ts` calcula un equivalente ilustrativo con una cotización fija (`USD_TO_ARS`), a reemplazar por una cotización real al conectar Mercado Pago de verdad.

**Cómo funciona la sesión (importante para entender el código)**: los dueños/empleados usan Supabase Auth de verdad (`auth.users`, contraseñas hasheadas por Supabase) — `src/lib/supabase/server.ts` es el único cliente atado a cookies (usa `@supabase/ssr`) y solo se usa para `signInWithPassword`/`getUser`/`signOut`; `src/proxy.ts` refresca el token en cada request. Todas las consultas de datos de negocio (canchas, reservas, caja, etc.) van por `src/lib/supabase/admin.ts`, un cliente con la service role key — esta app nunca llama a Supabase directo desde el browser, así que cada función de `db.ts` sigue filtrando explícitamente por `organizationId` (misma disciplina que antes, ahora contra la base real) en vez de depender de RLS como mecanismo principal. El superadmin sigue como antes (env vars + cookie propia `sc_admin_session`, sin Supabase Auth — no es un tenant). Los clientes invitados tampoco necesitan Auth: se identifican una vez por email y quedan recordados por cookie (`sc_customer`), con su `customerId` real de la tabla `customers`.

Lo que **no** está construido: permisos reales por rol dentro de una organización (el aislamiento *entre* organizaciones ya es real vía Supabase, pero un cajero y un owner todavía ven la misma UI), multi-sede/multi-ubicación dentro de una misma cuenta, el envío real de WhatsApp/email (hoy queda en el log de Notificaciones), y el cobro real de la suscripción vía Mercado Pago Suscripciones.

## Cómo correrlo

Necesitás un proyecto de Supabase con las migraciones aplicadas — ya no hay modo mock de respaldo.

```bash
npm install
cp .env.example .env.local   # completar con tus credenciales de Supabase
node --env-file=.env.local scripts/run-migrations.mjs   # crea las tablas (idempotente)
node --env-file=.env.local scripts/seed-demo.mjs        # opcional: siembra la demo de Palermo
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). Desde la landing podés **crear una cuenta gratis** (`/registro`), **iniciar sesión** si ya tenés una (`/login`), o entrar a **"Ver demo en vivo"** para reservar como cliente en el complejo de ejemplo sin crear nada.

**Cuenta demo** (organización "Sport Club Palermo", plan Business activo, con ~2700 reservas de historial real sembradas por `scripts/seed-demo.mjs`): iniciá sesión en `/login` con `martin@palermo.club` / `demo1234`. Su link de reserva público es `/sport-club-palermo/reservar`.

**Superadmin de la plataforma**: `/superadmin/login` con las credenciales de `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` (si no configurás nada, el default local es `admin@sportcontrol.app` / `super1234` — cambialo antes de desplegar esto en cualquier lugar público).

Una cuenta nueva creada por `/registro` arranca con 2 canchas de ejemplo (una de pádel, una de fútbol 5) para poder probar la reserva enseguida — desde `/admin/canchas` se pueden agregar más. A diferencia del modo mock anterior, estos datos ya son persistentes: sobreviven a un reinicio de `npm run dev`.

La caja arranca cerrada para una cuenta nueva (`/admin/caja`) — hay que abrirla para poder vender productos o ver movimientos en efectivo del día. Si corriste `seed-demo.mjs`, la demo de Palermo ya tiene 21 días de historial de caja cerrada.

## Conectar servicios reales

1. **Supabase — ya conectado**: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_DB_URL` en `.env.local` (ver `.env.example`). `scripts/run-migrations.mjs` aplica `supabase/migrations/*.sql` en orden (0001 a 0006), llevando registro de lo ya aplicado en una tabla `_migrations` — correrlo de nuevo después de agregar una migración nueva solo aplica la diferencia. `scripts/seed-demo.mjs` siembra la organización demo completa (corre una sola vez; si ya existe `sport-club-palermo` no hace nada).
2. **Mercado Pago**: completá `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_PUBLIC_KEY` en `.env.local` para los pagos de canchas/productos. Para la suscripción SaaS en sí hace falta además configurar un plan en Mercado Pago Suscripciones (fijando el precio en la moneda de tu cuenta MP) y reemplazar `activateSubscription()` en `src/lib/db.ts` por la integración real.

Mercado Pago es lo único que sigue simulado — `src/lib/actions.ts` marca cualquier pago (seña, saldo, suscripción) como "siempre aprobado".

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Supabase (Postgres + Auth) + lucide-react (íconos) + recharts (gráficos). Mercado Pago pendiente de conectar.
