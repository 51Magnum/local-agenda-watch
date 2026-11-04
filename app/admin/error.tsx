"use client";
import Link from "next/link";
export default function AdminError({reset}:{reset:()=>void}){
 return <main className="space-y-4 p-6"><h1 className="text-2xl font-semibold">This admin page could not load</h1><p>Its storage or source data may be unavailable. Check any saved job result before retrying an action. Other sections remain available in the admin menu.</p><button className="rounded border px-4 py-2" onClick={reset}>Reload this page</button><Link className="block underline" href="/admin">Return to admin overview</Link></main>;
}
