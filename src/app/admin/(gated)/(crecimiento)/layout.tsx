import { hasFeatureAccess } from "@/lib/db";
import { PlanUpsell } from "@/components/paywall";

export default function CrecimientoLayout({ children }: { children: React.ReactNode }) {
  if (!hasFeatureAccess("crecimiento")) return <PlanUpsell group="crecimiento" />;
  return <>{children}</>;
}
