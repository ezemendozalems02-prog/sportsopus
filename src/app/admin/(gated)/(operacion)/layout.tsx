import { hasFeatureAccess } from "@/lib/db";
import { PlanUpsell } from "@/components/paywall";

export default function OperacionLayout({ children }: { children: React.ReactNode }) {
  if (!hasFeatureAccess("operacion")) return <PlanUpsell group="operacion" />;
  return <>{children}</>;
}
