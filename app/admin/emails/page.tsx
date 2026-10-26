import EmailGallery from "./preview-gallery";
import { loadEmailExamples } from "@/lib/email/examples";
import { alertReadiness } from "@/lib/alerts";
export const dynamic="force-dynamic";
export default async function EmailPreviews(){
 const examples=await loadEmailExamples(),readiness=alertReadiness();
 return <main className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8"><h1 className="text-3xl font-semibold">Email previews</h1><p className="rounded-xl border border-amber-500 bg-amber-50 p-4 text-amber-950">{readiness.deliveryEnabled?"Live delivery gate is enabled for production.":"Live delivery is paused pending owner approval. Preview deployments never send subscription, digest, reminder, announcement, or correction emails automatically."} Test delivery sends only to the address you explicitly enter below.</p><p className="text-sm">Current public project data loaded {new Date().toLocaleString("en-US",{timeZone:"America/Denver"})} Mountain Time. Example saved places and correction reports are labelled. Test confirmation and unsubscribe links are inactive.</p><EmailGallery examples={examples} testReady={readiness.ready} announcementReady={readiness.deliveryEnabled&&process.env.ALERTS_ANNOUNCEMENTS_ENABLED==="true"}/></main>;
}
