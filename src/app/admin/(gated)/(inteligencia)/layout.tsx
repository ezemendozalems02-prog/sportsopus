import { hasFeatureAccess } from "@/lib/db";
import { PlanUpsell } from "@/components/paywall";

export default function InteligenciaLayout({ children }: { children: React.ReactNode }) {
  if (!hasFeatureAccess("inteligencia")) return <PlanUpsell group="inteligencia" />;
  return <>{children}</>;
}
