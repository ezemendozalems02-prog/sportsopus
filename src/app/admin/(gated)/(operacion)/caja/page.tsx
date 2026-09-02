import {
  getOpenCashSession,
  listCashMovements,
  listEmployees,
  listProductCategories,
  listProducts,
} from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui";
import { OpenSessionForm } from "./open-session-form";
import { CloseSessionForm } from "./close-session-form";
import { PosPanel } from "./pos-panel";

const MOVEMENT_LABELS: Record<string, string> = {
  venta: "Venta",
  cobro_reserva: "Cobro de reserva",
  ingreso_manual: "Ingreso manual",
  egreso_manual: "Egreso manual",
  gasto: "Gasto",
};

export default function CajaPage() {
  const session = getOpenCashSession();
  const products = listProducts();
  const categories = listProductCategories();

  if (!session) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Caja</h1>
        <div className="mt-10">
          <OpenSessionForm />
        </div>
      </div>
    );
  }

  const employee = listEmployees().find((e) => e.id === session.employeeId);
  const movements = listCashMovements(session.id);
  const cashMovements = movements.filter((m) => m.method === "efectivo");
  const expectedCash = session.openingAmount + cashMovements.reduce((sum, m) => sum + m.amount, 0);
  const totalsByMethod = movements.reduce<Record<string, number>>((acc, m) => {
    acc[m.method] = (acc[m.method] ?? 0) + m.amount;
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Caja</h1>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          Abierta · {employee?.name}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <PosPanel products={products} categories={categories} />

        <Card>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Resumen de caja</p>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Apertura</span>
              <span className="font-medium">{formatCurrency(session.openingAmount)}</span>
            </div>
            {Object.entries(totalsByMethod).map(([method, amount]) => (
              <div key={method} className="flex justify-between capitalize">
                <span className="text-zinc-500 dark:text-zinc-400">{method.replace("_", " ")}</span>
                <span className="font-medium">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 max-h-64 overflow-y-auto border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Movimientos</p>
            <div className="flex flex-col gap-2">
              {movements.length === 0 && <p className="text-sm text-zinc-400">Sin movimientos todavía.</p>}
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <p className="truncate text-zinc-700 dark:text-zinc-300">{m.concept}</p>
                    <p className="text-zinc-400">{MOVEMENT_LABELS[m.type]}</p>
                  </div>
                  <span className={`font-medium ${m.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {m.amount >= 0 ? "+" : ""}
                    {formatCurrency(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <CloseSessionForm sessionId={session.id} expectedCash={expectedCash} />
        </Card>
      </div>
    </div>
  );
}
