import type { Metadata } from "next";
import { SITE_ORIGIN } from "@/lib/site-config";
export const metadata: Metadata = { title: "Privacy", alternates: { canonical: SITE_ORIGIN + "/privacy" } };
export default function Privacy() {
  return <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-14">
    <h1 className="text-3xl font-semibold">Privacy</h1>
    <p className="leading-8">Local Agenda Watch currently has no user accounts, on-site comments or newsletter signup forms. Its application code does not include advertising trackers.</p>
    <p className="leading-8">The hosting provider may process request information, such as IP addresses and browser details, to deliver and secure the site. Public planning records may contain information supplied to the city.</p>
    <p className="leading-8">The share button copies a link on your device or opens your device’s sharing options. It does not submit contact details to Local Agenda Watch. Opening external maps, city portals or document links takes you to services with their own privacy policies.</p>
  </main>;
}
