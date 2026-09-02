import { computeAccessState } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { SubscriptionPaywall } from "@/components/paywall";

export default async function GatedLayout({ children }: { children: React.ReactNode }) {
  const { organizationId } = await requireEmployeeSession();
  const access = computeAccessState(organizationId);
  if (access.blocked) return <SubscriptionPaywall reason={access.reason} />;
  return <>{children}</>;
}
