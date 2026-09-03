// Siembra la organización demo "Sport Club Palermo" en la base real, con el
// mismo historial que tenía el modo mock (para que martin@palermo.club /
// demo1234 y el resto del panel se vean igual que antes).
// Uso: node --env-file=.env.local scripts/seed-demo.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function timeToMinutes(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToTime(m) { const h = Math.floor(m / 60) % 24; return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
function dayOfWeek(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getDay(); }
function todayISO() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; }
function addDaysISO(iso, days) { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(y, m - 1, d + days); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`; }
function formatArs(n) { return `$${Math.round(n).toLocaleString("es-AR")}`; }

const weekdayPadelRules = (base) => [
  { label: "Hora valle", days_of_week: [1, 2, 3, 4, 5], start_time: "08:00", end_time: "16:00", price_per_slot: base },
  { label: "Hora normal", days_of_week: [1, 2, 3, 4, 5], start_time: "16:00", end_time: "18:00", price_per_slot: Math.round(base * 1.2) },
  { label: "Hora pico", days_of_week: [1, 2, 3, 4, 5], start_time: "18:00", end_time: "23:00", price_per_slot: Math.round(base * 1.47) },
  { label: "Fin de semana", days_of_week: [0, 6], start_time: "08:00", end_time: "23:00", price_per_slot: Math.round(base * 1.67) },
];
const weekdayFutbolRules = (base) => [
  { label: "Hora valle", days_of_week: [1, 2, 3, 4, 5], start_time: "09:00", end_time: "17:00", price_per_slot: base },
  { label: "Hora pico", days_of_week: [1, 2, 3, 4, 5], start_time: "17:00", end_time: "23:00", price_per_slot: Math.round(base * 1.45) },
  { label: "Fin de semana", days_of_week: [0, 6], start_time: "09:00", end_time: "23:00", price_per_slot: Math.round(base * 1.6) },
];

function resolveSlotPrice(court, dateISO, startTime) {
  const dow = dayOfWeek(dateISO);
  const mins = timeToMinutes(startTime);
  const rule = court.priceRules.find((r) => r.days_of_week.includes(dow) && mins >= timeToMinutes(r.start_time) && mins < timeToMinutes(r.end_time));
  return rule ? rule.price_per_slot : court.priceRules[0].price_per_slot;
}
function computeDeposit(totalPrice) {
  const depositAmount = Math.round(totalPrice * 0.3);
  return { depositAmount, balanceAmount: totalPrice - depositAmount };
}
function listSlotStarts(court, dateISO) {
  if (!court.days_open.includes(dayOfWeek(dateISO))) return [];
  const open = timeToMinutes(court.open_time);
  const close = timeToMinutes(court.close_time);
  const starts = [];
  for (let t = open; t + court.slot_minutes <= close; t += court.slot_minutes) starts.push(minutesToTime(t));
  return starts;
}

async function main() {
  console.log("Creando organización...");
  const { data: existing } = await sb.from("organizations").select("id").eq("slug", "sport-club-palermo").maybeSingle();
  if (existing) {
    console.log("Ya existe sport-club-palermo — nada que hacer. Borrala primero si querés re-sembrar.");
    return;
  }

  const { data: org, error: orgErr } = await sb.from("organizations").insert({
    name: "Sport Club Palermo",
    slug: "sport-club-palermo",
    deposit_percentage: 0.3,
    plan: "business",
    subscription_status: "active",
    billing_email: "martin@palermo.club",
    current_period_end: addDaysISO(todayISO(), 18),
    mercadopago_subscription_id: "mp_sub_demo_1",
  }).select().single();
  if (orgErr) throw orgErr;
  const orgId = org.id;

  console.log("Creando empleados (Supabase Auth)...");
  const employeeDefs = [
    { name: "Martín Suárez", email: "martin@palermo.club", role: "owner" },
    { name: "Camila Ríos", email: "camila@palermo.club", role: "admin" },
    { name: "Nico Álvarez", email: "nico@palermo.club", role: "cajero" },
  ];
  const employees = [];
  for (const def of employeeDefs) {
    const { data: authUser, error: authErr } = await sb.auth.admin.createUser({ email: def.email, password: "demo1234", email_confirm: true });
    if (authErr) throw authErr;
    const { data: emp, error: empErr } = await sb.from("employees").insert({
      organization_id: orgId, user_id: authUser.user.id, name: def.name, email: def.email, role: def.role,
    }).select().single();
    if (empErr) throw empErr;
    employees.push(emp);
  }
  const ownerId = employees[0].id;
  const cashierIds = [employees[1].id, employees[2].id];

  console.log("Creando canchas...");
  const courtDefs = [
    { name: "Pádel 1", sport: "padel", surface: "sintetico", indoor: true, lighting: true, slot_minutes: 90, open_time: "08:00", close_time: "23:00", rules: weekdayPadelRules(15000), occupancy: 0.82 },
    { name: "Pádel 2", sport: "padel", surface: "sintetico", indoor: true, lighting: true, slot_minutes: 90, open_time: "08:00", close_time: "23:00", rules: weekdayPadelRules(15000), occupancy: 0.74 },
    { name: "Pádel 3", sport: "padel", surface: "sintetico", indoor: false, lighting: true, slot_minutes: 90, open_time: "08:00", close_time: "23:00", rules: weekdayPadelRules(16000), occupancy: 0.91 },
    { name: "Pádel 4", sport: "padel", surface: "sintetico", indoor: false, lighting: false, slot_minutes: 90, open_time: "08:00", close_time: "22:00", rules: weekdayPadelRules(13000), occupancy: 0.63 },
    { name: "Fútbol 5 #1", sport: "futbol5", surface: "sintetico", indoor: false, lighting: true, slot_minutes: 60, open_time: "09:00", close_time: "23:00", rules: weekdayFutbolRules(18000), occupancy: 0.88 },
    { name: "Fútbol 5 #2", sport: "futbol5", surface: "sintetico", indoor: false, lighting: true, slot_minutes: 60, open_time: "09:00", close_time: "23:00", rules: weekdayFutbolRules(18000), occupancy: 0.79 },
    { name: "Fútbol 8", sport: "futbol8", surface: "sintetico", indoor: false, lighting: true, slot_minutes: 60, open_time: "09:00", close_time: "23:00", rules: weekdayFutbolRules(26000), occupancy: 0.7 },
  ];
  const courts = [];
  for (const def of courtDefs) {
    const { data: court, error } = await sb.from("courts").insert({
      organization_id: orgId, name: def.name, sport: def.sport, surface: def.surface, indoor: def.indoor,
      lighting: def.lighting, slot_minutes: def.slot_minutes, open_time: def.open_time, close_time: def.close_time,
      days_open: [0, 1, 2, 3, 4, 5, 6],
    }).select().single();
    if (error) throw error;
    const { error: rulesErr } = await sb.from("court_price_rules").insert(def.rules.map((r) => ({ ...r, court_id: court.id })));
    if (rulesErr) throw rulesErr;
    courts.push({ ...court, priceRules: def.rules, occupancy: def.occupancy });
  }

  console.log("Creando clientes...");
  const customerNames = [
    "Juan Pérez", "Martín Gómez", "Lucas Díaz", "Sofía Fernández", "Agustina López",
    "Tomás Romero", "Valentina Torres", "Federico Ruiz", "Camila Sosa", "Nicolás Vega",
  ];
  const { data: customers, error: custErr } = await sb.from("customers").insert(
    customerNames.map((name, i) => ({
      organization_id: orgId, name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@mail.com`,
      phone: `+54 9 11 4${String(1000 + i * 37).padStart(4, "0")}-${String(2000 + i * 53).padStart(4, "0")}`,
      favorite_sport: i % 3 === 0 ? "futbol5" : "padel",
    }))
  ).select();
  if (custErr) throw custErr;

  console.log("Generando reservas históricas (35 días atrás a 6 adelante)...");
  const rand = mulberry32(20260902);
  const today = todayISO();
  const bookingRows = [];
  function statusForOffset(offset, r) {
    if (offset < 0) { if (r < 0.06) return "no_show"; if (r < 0.12) return "cancelada"; return "finalizada"; }
    if (offset === 0) { if (r < 0.5) return "confirmada"; if (r < 0.8) return "sena_pagada"; return "pendiente_pago"; }
    if (r < 0.55) return "confirmada"; if (r < 0.9) return "sena_pagada"; return "pendiente_pago";
  }
  for (let offset = -35; offset <= 6; offset++) {
    const dateISO = addDaysISO(today, offset);
    for (const court of courts) {
      for (const startTime of listSlotStarts(court, dateISO)) {
        if (rand() > court.occupancy) continue;
        const endMinutes = timeToMinutes(startTime) + court.slot_minutes;
        const status = statusForOffset(offset, rand());
        const totalPrice = resolveSlotPrice(court, dateISO, startTime);
        const { depositAmount, balanceAmount } = computeDeposit(totalPrice);
        const customer = customers[Math.floor(rand() * customers.length)];
        bookingRows.push({
          organization_id: orgId, court_id: court.id, customer_id: customer.id,
          date: dateISO, start_time: startTime, end_time: minutesToTime(endMinutes),
          total_price: totalPrice, deposit_amount: depositAmount, balance_amount: balanceAmount,
          status, created_at: `${addDaysISO(dateISO, -2)}T10:00:00`,
        });
      }
    }
  }
  const insertedBookings = [];
  for (let i = 0; i < bookingRows.length; i += 500) {
    const { data, error } = await sb.from("bookings").insert(bookingRows.slice(i, i + 500)).select();
    if (error) throw error;
    insertedBookings.push(...data);
  }
  console.log(`  ${insertedBookings.length} reservas creadas.`);

  console.log("Generando pagos de esas reservas...");
  const methods = ["mercado_pago", "efectivo", "transferencia", "tarjeta"];
  const paymentRows = [];
  for (const b of insertedBookings) {
    const method = methods[Math.floor(rand() * methods.length)];
    const paidAt = `${b.date}T${b.start_time}`;
    if (b.status !== "pendiente_pago") {
      paymentRows.push({ booking_id: b.id, concept: "sena", amount: b.deposit_amount, method: "mercado_pago", status: "aprobado", paid_at: paidAt });
    }
    if (["confirmada", "en_curso", "finalizada"].includes(b.status)) {
      paymentRows.push({ booking_id: b.id, concept: "saldo", amount: b.balance_amount, method, status: "aprobado", paid_at: paidAt });
    }
  }
  for (let i = 0; i < paymentRows.length; i += 500) {
    const { error } = await sb.from("booking_payments").insert(paymentRows.slice(i, i + 500));
    if (error) throw error;
  }
  console.log(`  ${paymentRows.length} pagos creados.`);

  console.log("Creando productos...");
  const categoryDefs = ["Bebidas", "Snacks", "Comidas", "Accesorios"];
  const { data: categories, error: catErr } = await sb.from("product_categories").insert(categoryDefs.map((name) => ({ organization_id: orgId, name }))).select();
  if (catErr) throw catErr;
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));
  const productDefs = [
    ["Agua", "Bebidas", "BEB-001", 1000, 2000, 38, 15],
    ["Gatorade", "Bebidas", "BEB-002", 1800, 3500, 8, 10],
    ["Coca-Cola", "Bebidas", "BEB-003", 1500, 3000, 24, 12],
    ["Cerveza", "Bebidas", "BEB-004", 2200, 4000, 30, 12],
    ["Café", "Bebidas", "BEB-005", 1000, 2500, 20, 10],
    ["Papas fritas", "Snacks", "SNK-001", 1400, 3000, 6, 10],
    ["Alfajor", "Snacks", "SNK-002", 900, 1800, 40, 15],
    ["Barrita de cereal", "Snacks", "SNK-003", 1100, 2200, 9, 10],
    ["Hamburguesa", "Comidas", "CMD-001", 3500, 7000, 18, 8],
    ["Pancho", "Comidas", "CMD-002", 2000, 4500, 22, 8],
    ["Pelotas de pádel (tubo x3)", "Accesorios", "ACC-001", 7000, 12000, 14, 6],
    ["Grip", "Accesorios", "ACC-002", 1200, 2500, 3, 8],
    ["Remera del club", "Accesorios", "ACC-003", 9000, 18000, 11, 5],
    ["Paleta de pádel", "Accesorios", "ACC-004", 55000, 85000, 4, 3],
  ];
  const { data: products, error: prodErr } = await sb.from("products").insert(
    productDefs.map(([name, cat, sku, cost, price, stock, minStock]) => ({
      organization_id: orgId, category_id: catByName[cat], name, sku, cost, price, stock, min_stock: minStock,
    }))
  ).select();
  if (prodErr) throw prodErr;

  console.log("Generando gastos (28 días)...");
  const expenseCategories = [
    ["alquiler", "Alquiler del predio", 850000], ["sueldos", "Sueldos del personal", 1450000],
    ["luz", "Factura de luz", 180000], ["agua", "Factura de agua", 60000],
    ["mantenimiento", "Mantenimiento de canchas", 120000], ["insumos", "Compra de bebidas y snacks", 210000],
    ["limpieza", "Insumos de limpieza", 45000], ["publicidad", "Publicidad en redes", 60000],
  ];
  const expenseRows = [];
  for (let offset = -28; offset <= -1; offset++) {
    const dateISO = addDaysISO(today, offset);
    if (dateISO.endsWith("-01")) {
      expenseRows.push({ organization_id: orgId, employee_id: ownerId, category: "alquiler", description: "Alquiler del predio", amount: 850000, date: dateISO });
      expenseRows.push({ organization_id: orgId, employee_id: ownerId, category: "sueldos", description: "Sueldos del personal", amount: 1450000, date: dateISO });
    }
    if (dayOfWeek(dateISO) === 5 && rand() < 0.7) {
      const [category, label, amount] = expenseCategories[Math.floor(rand() * expenseCategories.length)];
      expenseRows.push({ organization_id: orgId, employee_id: ownerId, category, description: label, amount: Math.round(amount * (0.7 + rand() * 0.6)), date: dateISO });
    }
  }
  const { error: expErr } = await sb.from("expenses").insert(expenseRows);
  if (expErr) throw expErr;
  console.log(`  ${expenseRows.length} gastos creados.`);

  console.log("Generando historial de caja (21 días)...");
  for (let offset = -21; offset <= -1; offset++) {
    const dateISO = addDaysISO(today, offset);
    const employeeId = cashierIds[Math.floor(rand() * cashierIds.length)];
    const openingAmount = 20000;
    let cashTotal = openingAmount;

    const { data: session, error: sessErr } = await sb.from("cash_registers").insert({
      organization_id: orgId, employee_id: employeeId, status: "cerrada", opening_amount: openingAmount,
      opened_at: `${dateISO}T09:00:00`,
    }).select().single();
    if (sessErr) throw sessErr;

    const saleCount = 4 + Math.floor(rand() * 6);
    for (let i = 0; i < saleCount; i++) {
      const itemCount = 1 + Math.floor(rand() * 3);
      const items = [];
      for (let j = 0; j < itemCount; j++) {
        const product = products[Math.floor(rand() * products.length)];
        const quantity = 1 + Math.floor(rand() * 2);
        items.push({ product_id: product.id, name: product.name, quantity, unit_price: product.price });
      }
      const total = items.reduce((s, it) => s + it.unit_price * it.quantity, 0);
      const method = methods[Math.floor(rand() * methods.length)];
      const time = `${String(9 + Math.floor(rand() * 13)).padStart(2, "0")}:${rand() < 0.5 ? "00" : "30"}`;
      const createdAt = `${dateISO}T${time}:00`;

      const { data: sale, error: saleErr } = await sb.from("sales").insert({
        organization_id: orgId, cash_session_id: session.id, employee_id: employeeId, total, method, created_at: createdAt,
      }).select().single();
      if (saleErr) throw saleErr;
      await sb.from("sale_items").insert(items.map((it) => ({ ...it, sale_id: sale.id })));
      await sb.from("cash_movements").insert({
        organization_id: orgId, cash_session_id: session.id, type: "venta", amount: total, method,
        concept: items.map((it) => `${it.quantity}x ${it.name}`).join(", "), employee_id: employeeId, created_at: createdAt,
      });
      if (method === "efectivo") cashTotal += total;
    }

    const closingCountedAmount = Math.max(0, Math.round(cashTotal + (rand() - 0.5) * 2000));
    await sb.from("cash_registers").update({ closing_counted_amount: closingCountedAmount, closed_at: `${dateISO}T22:00:00` }).eq("id", session.id);
    await sb.from("audit_logs").insert({ organization_id: orgId, employee_id: employeeId, action: "Cierre de caja", detail: `Caja cerrada con ${formatArs(closingCountedAmount)} contados`, created_at: `${dateISO}T22:01:00` });
  }

  console.log("Creando promoción y beneficios de fidelización...");
  await sb.from("promotions").insert({
    organization_id: orgId, label: "Happy Hour Pádel", discount_percentage: 0.2,
    days_of_week: [1, 2, 3, 4], start_time: "14:00", end_time: "17:00", sports: ["padel"], active: true,
  });
  await sb.from("loyalty_rewards").insert([
    { organization_id: orgId, label: "Bebida gratis", points_cost: 150, kind: "producto" },
    { organization_id: orgId, label: "$10.000 de descuento", points_cost: 1000, kind: "descuento" },
    { organization_id: orgId, label: "Hora bonificada", points_cost: 1800, kind: "hora_bonificada" },
  ]);
  await sb.from("customers").update({ loyalty_points: 733 }).eq("id", customers[1].id);
  await sb.from("customers").update({ loyalty_points: 1466 }).eq("id", customers[4].id);

  console.log("Creando torneos...");
  const { data: t1, error: t1Err } = await sb.from("tournaments").insert({
    organization_id: orgId, name: "Torneo Apertura Pádel", sport: "padel", category: "8va",
    date: addDaysISO(today, 12), max_teams: 8, entry_fee: 30000, prize: "Trofeo + kit de pelotas",
    status: "en_curso", created_at: addDaysISO(today, -20),
  }).select().single();
  if (t1Err) throw t1Err;

  const t1Pairs = [
    ["Juan Pérez", "Martín Gómez"], ["Lucas Díaz", "Sofía Fernández"], ["Agustina López", "Tomás Romero"],
    ["Valentina Torres", "Federico Ruiz"], ["Camila Sosa", "Nicolás Vega"], ["Rocío Medina", "Ezequiel Paz"],
    ["Brenda Acosta", "Ignacio Castro"], ["Milagros Ibáñez", "Franco Molina"],
  ];
  const { data: t1Teams, error: t1TeamsErr } = await sb.from("tournament_teams").insert(
    t1Pairs.map(([p1, p2]) => ({ tournament_id: t1.id, name: `${p1.split(" ")[0]} / ${p2.split(" ")[0]}`, player_names: [p1, p2], paid_entry: true, registered_at: addDaysISO(today, -18) }))
  ).select();
  if (t1TeamsErr) throw t1TeamsErr;

  const round1 = [];
  for (let i = 0; i < 4; i++) {
    round1.push({ tournament_id: t1.id, round: 1, match_index: i, team_a_id: t1Teams[i * 2].id, team_b_id: t1Teams[i * 2 + 1].id, status: "pendiente" });
  }
  const round2 = [0, 1].map((i) => ({ tournament_id: t1.id, round: 2, match_index: i, status: "pendiente" }));
  const round3 = [{ tournament_id: t1.id, round: 3, match_index: 0, status: "pendiente" }];
  const { data: allMatches, error: matchesErr } = await sb.from("tournament_matches").insert([...round1, ...round2, ...round3]).select();
  if (matchesErr) throw matchesErr;

  const r1 = allMatches.filter((m) => m.round === 1).sort((a, b) => a.match_index - b.match_index);
  const r2 = allMatches.filter((m) => m.round === 2).sort((a, b) => a.match_index - b.match_index);
  const round1Winners = [0, 0, 1, 0];
  const scores = ["6-4 6-3", "7-5 4-6 6-2", "6-2 6-4", "6-3 6-4"];
  for (let i = 0; i < r1.length; i++) {
    const winnerId = round1Winners[i] === 0 ? r1[i].team_a_id : r1[i].team_b_id;
    await sb.from("tournament_matches").update({ status: "jugado", winner_team_id: winnerId, score_label: scores[i] }).eq("id", r1[i].id);
    const nextMatch = r2[Math.floor(i / 2)];
    const field = i % 2 === 0 ? "team_a_id" : "team_b_id";
    await sb.from("tournament_matches").update({ [field]: winnerId }).eq("id", nextMatch.id);
  }
  const { data: semi1 } = await sb.from("tournament_matches").select("*").eq("id", r2[0].id).single();
  await sb.from("tournament_matches").update({ status: "jugado", winner_team_id: semi1.team_a_id, score_label: "6-4 6-2" }).eq("id", semi1.id);
  const finalMatch = allMatches.find((m) => m.round === 3);
  await sb.from("tournament_matches").update({ team_a_id: semi1.team_a_id }).eq("id", finalMatch.id);

  const { error: t2Err } = await sb.from("tournaments").insert({
    organization_id: orgId, name: "Copa Otoño Fútbol 5", sport: "futbol5", category: "Libre",
    date: addDaysISO(today, 25), max_teams: 8, entry_fee: 15000, prize: "Copa + medallas",
    status: "inscripcion", created_at: addDaysISO(today, -5),
  }).select().single();
  if (t2Err) throw t2Err;
  const { data: t2 } = await sb.from("tournaments").select("id").eq("organization_id", orgId).eq("name", "Copa Otoño Fútbol 5").single();
  const t2TeamsDefs = [
    { name: "Los Pibes FC", players: ["Diego Herrera", "Pablo Ríos", "Marcos Silva", "Emiliano Cruz", "Agustín Blanco"] },
    { name: "Tigres FC", players: ["Rodrigo Luna", "Bruno Vega", "Santiago Ortiz", "Julián Paz", "Matías Correa"] },
    { name: "Atlético Palermo", players: ["Franco Aguirre", "Nahuel Rivas", "Joaquín Soto", "Ramiro Núñez", "Ivo Campos"] },
  ];
  await sb.from("tournament_teams").insert(t2TeamsDefs.map((t) => ({ tournament_id: t2.id, name: t.name, player_names: t.players, paid_entry: true, registered_at: addDaysISO(today, -3) })));

  console.log("Creando historial de facturación de la suscripción...");
  for (let i = 3; i >= 1; i--) {
    const periodStart = addDaysISO(today, -30 * i);
    const periodEnd = addDaysISO(periodStart, 30);
    await sb.from("billing_invoices").insert({ organization_id: orgId, plan: "business", amount_usd: 97, status: "pagada", period_start: periodStart, period_end: periodEnd, created_at: `${periodStart}T09:00:00` });
  }

  await sb.from("audit_logs").insert({ organization_id: orgId, employee_id: ownerId, action: "Cuenta creada", detail: "Sport Club Palermo · plan business · datos demo sembrados" });

  console.log("\nListo. Organización:", org.id, "slug: sport-club-palermo");
  console.log("Login demo: martin@palermo.club / demo1234");
}

main().catch((e) => { console.error(e); process.exit(1); });
