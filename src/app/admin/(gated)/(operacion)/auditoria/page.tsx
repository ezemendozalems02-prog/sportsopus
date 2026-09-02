import { listAuditLog } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { Card } from "@/components/ui";

export default async function AuditoriaPage() {
  const { organizationId } = await requireEmployeeSession();
  const entries = listAuditLog(organizationId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Auditoría</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Quién hizo qué y cuándo, para poder responder por cualquier movimiento de dinero.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {entries.map((entry) => (
          <Card key={entry.id} className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{entry.action}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{entry.detail}</p>
              <p className="mt-1 text-xs text-zinc-400">{entry.employeeName}</p>
            </div>
            <span className="shrink-0 text-xs text-zinc-400">
              {new Date(entry.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </Card>
        ))}
        {entries.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-400">Todavía no hay actividad registrada.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
