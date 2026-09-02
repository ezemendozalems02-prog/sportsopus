export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export const SPORT_LABELS: Record<string, string> = {
  padel: "Pádel",
  futbol5: "Fútbol 5",
  futbol8: "Fútbol 8",
  futbol11: "Fútbol 11",
};

export const BOOKING_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendiente_pago: { label: "Pendiente de pago", color: "amber" },
  sena_pagada: { label: "Seña pagada", color: "blue" },
  confirmada: { label: "Confirmada", color: "violet" },
  en_curso: { label: "En curso", color: "orange" },
  finalizada: { label: "Finalizada", color: "zinc" },
  cancelada: { label: "Cancelada", color: "red" },
  no_show: { label: "No show", color: "red" },
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  luz: "Luz",
  agua: "Agua",
  alquiler: "Alquiler",
  sueldos: "Sueldos",
  mantenimiento: "Mantenimiento",
  insumos: "Insumos",
  limpieza: "Limpieza",
  publicidad: "Publicidad",
  reparaciones: "Reparaciones",
  otro: "Otro",
};

export const EMPLOYEE_ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  cajero: "Cajero",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mercado_pago: "Mercado Pago",
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  trialing: { label: "Prueba gratis", color: "blue" },
  active: { label: "Activo", color: "green" },
  past_due: { label: "Pago pendiente", color: "amber" },
  canceled: { label: "Cancelado", color: "red" },
};

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
