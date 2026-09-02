import { hasFeatureAccess } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { PlanUpsell } from "@/components/paywall";

export default async function InteligenciaLayout({ children }: { children: React.ReactNode }) {
  const { organizationId } = await requireEmployeeSession();
  if (!hasFeatureAccess(organizationId, "inteligencia")) return <PlanUpsell group="inteligencia" />;
  return <>{children}</>;
}
