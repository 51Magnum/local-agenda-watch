import { permanentRedirect } from "next/navigation";
import { getLocalityContext, localityHref } from "@/lib/locality";

export default async function LegacyTollBrothersPage() {
  const ctx = await getLocalityContext();
  permanentRedirect(localityHref("nampa", "/braeburn-creek", ctx));
}
