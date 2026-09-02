# SportControl

ERP + reservas + caja + clientes + torneos + métricas para complejos deportivos (pádel, fútbol, o ambos). Ver el concepto completo discutido en la conversación que originó este repo.

## Estado actual: Fases 1-4 completas + capa SaaS (planes, prueba gratis, facturación) — MVP con datos mock

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

**SaaS — planes, prueba gratis y facturación**
- Página de precios pública (`/planes`) con los 3 planes: **Starter USD 27**, **Pro USD 57**, **Business USD 97**/mes. Cada uno desbloquea más del panel: Starter solo el core (dashboard, agenda, canchas, clientes), Pro suma Operación (caja, inventario, gastos, empleados, auditoría), Business suma Crecimiento e Inteligencia (torneos, ranking, promociones, notificaciones, analítica, alertas, reportes).
- Registro con prueba gratis de 7 días (`/registro`) — como el sistema es de un solo complejo (todavía sin Supabase Auth), esto activa la prueba sobre la cuenta de ejemplo en vez de crear un tenant nuevo; queda explicado en la propia pantalla.
- Gestión de la suscripción (`/admin/plan`): plan actual, días de prueba restantes, cambio de plan, "activar" la suscripción (pago simulado, siempre aprobado, como el resto de los pagos de esta demo), cancelar, historial de facturación. Incluye un botón de solo-demo para simular que la prueba venció y ver el paywall sin esperar 7 días reales.
- El panel bloquea de verdad las secciones que no correspondan al plan (a nivel de layout de cada grupo de rutas, no solo visualmente) y muestra un paywall completo si la prueba venció o la suscripción está cancelada — pero **no** hace cumplir esto contra manipulación del cliente porque no hay sesión de servidor real todavía (`getCurrentEmployee()` sigue siendo mock).
- Precio de referencia en USD como pediste; Mercado Pago Suscripciones cobra en la moneda de la cuenta MP (normalmente ARS) — `src/lib/db.ts` calcula un equivalente ilustrativo con una cotización fija (`USD_TO_ARS`), a reemplazar por una cotización real o por definir el precio directamente en ARS al conectar Mercado Pago de verdad.

Lo que **no** está construido (fuera del alcance del concepto original en 4 fases): permisos reales por rol y multi-tenant real (ambos requieren Supabase Auth — ver abajo), multi-sede/multi-ubicación, el envío real de WhatsApp/email (hoy queda en el log de Notificaciones), y el cobro real de la suscripción vía Mercado Pago Suscripciones.

## Cómo correrlo

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). Desde ahí podés entrar como "Soy cliente" (reservar, ver mis turnos, torneos, beneficios), "Panel del negocio" (dashboard, agenda, canchas, clientes, caja, inventario, gastos, empleados, auditoría, torneos, ranking, promociones, notificaciones, analítica, alertas, reportes, plan y facturación), o ver [/planes](http://localhost:3000/planes) y probar el registro con prueba gratis.

La cuenta de ejemplo arranca en **plan Business, activa** (para poder explorar todo el sistema sin restricciones). Para ver el flujo de prueba gratis y el bloqueo por plan, andá a `/registro`, elegí un plan, y desde `/admin/plan` podés cambiar de plan o simular que la prueba venció.

La caja arranca cerrada en cada reinicio del servidor (`/admin/caja`) — hay que abrirla para poder vender productos o ver movimientos en efectivo del día.

No hace falta configurar nada para probarlo: sin variables de entorno, la app usa datos mock y un pago de Mercado Pago siempre "aprobado".

## Conectar servicios reales

1. **Supabase**: creá un proyecto, corré `supabase/migrations/0001_init.sql`, `0002_operacion.sql`, `0003_crecimiento.sql` y `0004_saas.sql` (en ese orden) contra tu base, y completá `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` (ver `.env.example`). El schema es multi-tenant con RLS por `organization_id` desde el día uno. Conectar Auth de verdad es también el paso que habilita que `/registro` cree organizaciones nuevas de verdad en vez de reconfigurar la única cuenta demo.
2. **Mercado Pago**: completá `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_PUBLIC_KEY` en `.env.local` para los pagos de canchas/productos. Para la suscripción SaaS en sí hace falta además configurar un plan en Mercado Pago Suscripciones (fijando el precio en la moneda de tu cuenta MP) y reemplazar `activateSubscription()` en `src/lib/db.ts` por la integración real.

Ninguna de las dos está conectada al código todavía — hoy `src/lib/db.ts` sirve todo desde memoria y `src/lib/actions.ts` simula el pago de la seña y de la suscripción. El paso siguiente natural es reemplazar las funciones de `db.ts` por consultas reales a Supabase, una por una, sin tocar las páginas que las usan.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4. Pensado para sumar Supabase (Postgres + Auth) y Mercado Pago cuando haya credenciales.

# sportsopus
