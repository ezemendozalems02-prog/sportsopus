import "server-only";

const MP_API = "https://api.mercadopago.com";

function accessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");
  return token;
}

export interface MpPreapproval {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  preapproval_plan_id?: string;
  payer_email?: string;
}

// Suscripciones de Mercado Pago cobran un monto fijo en ARS — no hay "webhook
// push" con el payload completo confiable, así que ante cualquier evento
// volvemos a pedirle el estado real a la API en vez de confiar en el body
// que llega (más simple que verificar la firma, e igual de seguro: solo
// actuamos sobre lo que la propia cuenta de Mercado Pago confirma).
export async function fetchPreapproval(preapprovalId: string): Promise<MpPreapproval> {
  const res = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`No se pudo consultar la suscripción de Mercado Pago (${res.status})`);
  return res.json();
}
