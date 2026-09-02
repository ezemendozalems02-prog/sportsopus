# SportControl

ERP + reservas + caja + clientes + torneos + métricas para complejos deportivos (pádel, fútbol, o ambos). Ver el concepto completo discutido en la conversación que originó este repo.

## Estado actual: Fases 1-4 + SaaS multicuenta real (registro, login, panel superadmin) — MVP con datos mock

Lo que ya funciona, con datos en memoria (`src/lib/db.ts`) en vez de una base real:

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
- **Login (`/login`)** para dueños/empleados existentes (sesión por cookie, simulada pero funcionalmente real — ver "Cómo funciona la sesión" abajo). El panel `/admin` completo pasa a requerir sesión: sin ella, redirige a `/login`.
- **Link de reserva propio por complejo**: cada organización tiene su propia app pública en `/{slug-del-complejo}/reservar` (más `/mis-reservas`, `/torneos`, `/beneficios` bajo el mismo slug) — es el link que un dueño comparte con sus clientes, y solo muestra las canchas y reservas de ese complejo. Un cliente que reserva se identifica con nombre/email/teléfono la primera vez (sin contraseña) y queda recordado por cookie para sus próximas visitas a ese mismo complejo.
- **Panel superadmin (`/superadmin`)**: login propio (`/superadmin/login`), separado de las cuentas de los dueños de cancha. Dashboard con total de organizaciones, MRR estimado, distribución de planes y prueba gratis por vencer; listado completo de organizaciones (`/superadmin/organizaciones`) y el detalle de cada una con sus empleados, canchas, reservas y facturación, más acciones para cambiarle el plan o el estado de la suscripción sin pasar por esa cuenta.
- Gestión de la propia suscripción (`/admin/plan`): plan actual, días de prueba restantes, cambio de plan, "activar" la suscripción (pago simulado, siempre aprobado), cancelar, historial de facturación, botón de solo-demo para simular que la prueba venció.
- El panel bloquea de verdad las secciones que no correspondan al plan y muestra un paywall si la prueba venció o la suscripción está cancelada — y ahora **si sí** hace cumplir el acceso contra manipulación del cliente, porque cada request al panel resuelve la organización desde la sesión de servidor, no desde algo que el cliente pueda falsear.
- Precio de referencia en USD como se pidió; Mercado Pago Suscripciones cobra en la moneda de la cuenta MP (normalmente ARS) — `src/lib/db.ts` calcula un equivalente ilustrativo con una cotización fija (`USD_TO_ARS`), a reemplazar por una cotización real al conectar Mercado Pago de verdad.

**Cómo funciona la sesión (importante para entender el código)**: no hay Supabase Auth conectado todavía, así que el login es una simulación con forma real — `src/lib/db.ts` guarda un `Map<token, sesión>` en memoria y `src/lib/session.ts` es la única pieza que toca cookies (`sc_session` para dueños/empleados, `sc_admin_session` para el superadmin, `sc_customer` para clientes invitados). Cada función de `db.ts` que antes leía un "org actual" implícito ahora recibe `organizationId` como parámetro explícito — cada página/acción lo resuelve por su cuenta llamando a `requireEmployeeSession()` (redirige a `/login` si no hay sesión) o a partir del slug de la URL, nunca por una variable global (que sí se compartiría entre pedidos de tenants distintos). Las contraseñas de `Employee` son texto plano solo por ser mock — se reemplazan por completo cuando se conecte Supabase Auth.

Lo que **no** está construido: permisos reales por rol dentro de una organización (ya no hace falta Supabase Auth para el aislamiento *entre* organizaciones, que ahora es real, pero sí para roles como "cajero no puede ver reportes"), multi-sede/multi-ubicación dentro de una misma cuenta, el envío real de WhatsApp/email (hoy queda en el log de Notificaciones), y el cobro real de la suscripción vía Mercado Pago Suscripciones.

## Cómo correrlo

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). Desde la landing podés **crear una cuenta gratis** (`/registro`), **iniciar sesión** si ya tenés una (`/login`), o entrar a **"Ver demo en vivo"** para reservar como cliente en el complejo de ejemplo sin crear nada.

**Cuenta demo** (organización "Sport Club Palermo", plan Business activo, con historial completo de las Fases 1-4): iniciá sesión en `/login` con `martin@palermo.club` / `demo1234`. Su link de reserva público es `/sport-club-palermo/reservar`.

**Superadmin de la plataforma**: `/superadmin/login` con las credenciales de `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` (si no configurás nada, el default local es `admin@sportcontrol.app` / `super1234` — cambialo antes de desplegar esto en cualquier lugar público).

Una cuenta nueva creada por `/registro` arranca con 2 canchas de ejemplo (una de pádel, una de fútbol 5) para poder probar la reserva enseguida — desde `/admin/canchas` se pueden agregar más. Los datos de las cuentas nuevas (y de la sesión) son en memoria: se pierden al reiniciar `npm run dev`, igual que pasaba antes con la prueba gratis.

La caja arranca cerrada en cada reinicio del servidor (`/admin/caja`) — hay que abrirla para poder vender productos o ver movimientos en efectivo del día.

No hace falta configurar nada para probarlo: sin variables de entorno, la app usa datos mock y un pago de Mercado Pago siempre "aprobado".

## Conectar servicios reales

1. **Supabase**: creá un proyecto, corré `supabase/migrations/0001_init.sql`, `0002_operacion.sql`, `0003_crecimiento.sql`, `0004_saas.sql` y `0005_multitenant_auth.sql` (en ese orden) contra tu base, y completá `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` (ver `.env.example`). El schema es multi-tenant con RLS por `organization_id` desde el día uno. Conectar Auth de verdad reemplaza por completo `src/lib/session.ts` (cookies + Map en memoria) por las sesiones reales de Supabase, y hace que `/registro` use `supabase.auth.admin.createUser()` con la service role key en vez de `createOrganization()` en `db.ts` — ver el comentario al final de `0005_multitenant_auth.sql` para el detalle del flujo.
2. **Mercado Pago**: completá `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_PUBLIC_KEY` en `.env.local` para los pagos de canchas/productos. Para la suscripción SaaS en sí hace falta además configurar un plan en Mercado Pago Suscripciones (fijando el precio en la moneda de tu cuenta MP) y reemplazar `activateSubscription()` en `src/lib/db.ts` por la integración real.

Ninguna de las dos está conectada al código todavía — hoy `src/lib/db.ts` sirve todo desde memoria y `src/lib/actions.ts` simula el pago de la seña y de la suscripción. El paso siguiente natural es reemplazar las funciones de `db.ts` por consultas reales a Supabase, una por una, sin tocar las páginas que las usan (ya reciben `organizationId` como parámetro, así que el cambio es mecánico).

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + lucide-react (íconos) + recharts (gráficos). Pensado para sumar Supabase (Postgres + Auth) y Mercado Pago cuando haya credenciales.
