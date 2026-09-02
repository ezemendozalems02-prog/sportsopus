import { getCustomer, listNotifications } from "@/lib/db";
import { Card } from "@/components/ui";

const KIND_LABELS: Record<string, string> = {
  reserva_confirmada: "Reserva confirmada",
  recordatorio: "Recordatorio",
  cancelacion: "Cancelación",
  lista_espera_liberada: "Lista de espera",
  torneo_inscripcion: "Inscripción a torneo",
};

export default function NotificacionesPage() {
  const notifications = listNotifications();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Notificaciones</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Lo que se le enviaría a cada cliente por WhatsApp. Simulado — todavía no hay una cuenta de WhatsApp
        Business conectada, así que esto queda como un registro en vez de un envío real.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {notifications.map((n) => {
          const customer = getCustomer(n.customerId);
          return (
            <Card key={n.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  {KIND_LABELS[n.kind]} · {customer?.name}
                </p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">💬 {n.message}</p>
              </div>
              <span className="shrink-0 text-xs text-zinc-400">
                {new Date(n.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </Card>
          );
        })}
        {notifications.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-400">Todavía no se generaron notificaciones.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
