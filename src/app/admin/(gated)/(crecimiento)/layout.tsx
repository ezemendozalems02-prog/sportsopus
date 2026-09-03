import { hasFeatureAccess } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { PlanUpsell } from "@/components/paywall";

export default async function CrecimientoLayout({ children }: { children: React.ReactNode }) {
  const { organizationId } = await requireEmployeeSession();
  if (!(await hasFeatureAccess(organizationId, "crecimiento"))) return <PlanUpsell group="crecimiento" />;
  return <>{children}</>;
}
