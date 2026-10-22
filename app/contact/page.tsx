import type { Metadata } from "next";
import { SITE_ORIGIN, CONTACT_EMAIL, CONTACT_PLACEHOLDER } from "@/lib/site-config";
export const metadata: Metadata = { title: "Contact", alternates: { canonical: SITE_ORIGIN + "/contact" } };
export default function Contact() {
  return <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-14">
    <h1 className="text-3xl font-semibold">Contact</h1>
    <p>{CONTACT_EMAIL ? <a href={"mailto:" + CONTACT_EMAIL} className="underline underline-offset-4">{CONTACT_EMAIL}</a> : CONTACT_PLACEHOLDER}</p>
    <p className="leading-8">For official comments about a pending city case, follow the city’s participation instructions. Local Agenda Watch does not submit testimony to the city.</p>
    <a href="https://www.cityofnampa.us/1616/Public-Comment" className="inline-block underline underline-offset-4">City of Nampa public comment instructions</a>
  </main>;
}
