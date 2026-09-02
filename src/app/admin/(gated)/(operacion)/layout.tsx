import { hasFeatureAccess } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { PlanUpsell } from "@/components/paywall";

export default async function OperacionLayout({ children }: { children: React.ReactNode }) {
  const { organizationId } = await requireEmployeeSession();
  if (!hasFeatureAccess(organizationId, "operacion")) return <PlanUpsell group="operacion" />;
  return <>{children}</>;
}
