import { NextRequest, NextResponse } from "next/server";
import { fetchPreapproval } from "@/lib/mercadopago";
import { getOrganizationByMpPreapproval, getPlanByMpPreapprovalPlanId, syncMercadoPagoSubscription } from "@/lib/db";

// Mercado Pago pega acá en cada cambio de la suscripción (autorizada,
// pausada, cancelada, cada cobro recurrente). En vez de confiar en el
// contenido del request, se usa solo para saber "algo cambió en este
// preapproval" y se vuelve a pedir el estado real a la API de MP con
// nuestro propio access token antes de tocar la base.
async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") ?? url.searchParams.get("type");
  let id = url.searchParams.get("id") ?? url.searchParams.get("data.id");

  if (!id && req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.data?.id) id = String(body.data.id);
    } catch {
      // sin body o no es JSON — nada que procesar
    }
  }

  const isSubscriptionEvent = topic === "preapproval" || topic === "subscription_preapproval";
  if (!isSubscriptionEvent || !id) return NextResponse.json({ ok: true });

  try {
    const preapproval = await fetchPreapproval(id);
    const organization = await getOrganizationByMpPreapproval(preapproval.id);
    if (organization) {
      const plan = preapproval.preapproval_plan_id ? getPlanByMpPreapprovalPlanId(preapproval.preapproval_plan_id) : undefined;
      await syncMercadoPagoSubscription(organization.id, preapproval.id, plan?.id, preapproval.status, preapproval.payer_email);
    }
  } catch {
    // Si falla la consulta a MP, no hay nada más para hacer acá; MP
    // reintenta este mismo webhook más adelante.
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
