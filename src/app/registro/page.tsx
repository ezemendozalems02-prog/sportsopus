import Link from "next/link";
import { getOrganization, listPlans } from "@/lib/db";
import type { PlanId } from "@/lib/types";
import { SignupForm } from "./signup-form";

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const plans = listPlans();
  const org = getOrganization();
  const validPlan = plans.some((p) => p.id === plan) ? (plan as PlanId) : "pro";

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="mb-6 text-center">
        <Link href="/planes" className="text-sm text-zinc-500 dark:text-zinc-400">
          ← Ver planes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Empezá tu prueba gratis</h1>
      </div>
      <SignupForm plans={plans} initialPlan={validPlan} orgName={org.name} />
    </div>
  );
}
