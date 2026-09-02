import { listExpensesForMonth } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { EXPENSE_CATEGORY_LABELS, formatCurrency } from "@/lib/format";
import { todayISO } from "@/lib/time";
import { Card, StatTile } from "@/components/ui";
import { AddExpenseForm } from "./add-expense-form";

export default async function GastosPage() {
  const { organizationId } = await requireEmployeeSession();
  const currentMonth = todayISO().slice(0, 7);
  const expenses = listExpensesForMonth(organizationId, currentMonth);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Gastos</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Mes actual · {expenses.length} registros</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile label="Total del mes" value={formatCurrency(total)} />
        <Card>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Por categoría</p>
          <div className="mt-2 flex flex-col gap-1">
            {topCategories.slice(0, 4).map(([category, amount]) => (
              <div key={category} className="flex justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{EXPENSE_CATEGORY_LABELS[category]}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(amount)}</span>
              </div>
            ))}
            {topCategories.length === 0 && <p className="text-sm text-zinc-400">Sin gastos este mes.</p>}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <AddExpenseForm />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {expenses.map((expense) => (
          <Card key={expense.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{expense.description}</p>
              <p className="text-xs text-zinc-400">
                {EXPENSE_CATEGORY_LABELS[expense.category]} · {expense.date}
              </p>
            </div>
            <span className="font-medium text-red-600 dark:text-red-400">−{formatCurrency(expense.amount)}</span>
          </Card>
        ))}
        {expenses.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-400">No hay gastos registrados este mes.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
