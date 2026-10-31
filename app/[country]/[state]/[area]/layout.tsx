import {isPreview} from "@/lib/runtime-environment";
import Link from "next/link";
import {readReviewSnapshot} from "@/lib/jurisdictions/review-snapshot";
export default async function AreaLayout({children,params}:{children:React.ReactNode;params:Promise<{area:string}>}){
 const review=isPreview()?readReviewSnapshot((await params).area):undefined;
 return <>{review&&<aside className="border-b border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-950"><strong>Review snapshot · not published.</strong> Collected {review.collectedAt.slice(0,10)}. {review.selfCheck.goLive?"Self-check gate passing.":"Go-live withheld; source checks need review."} Subscriptions and admin writes are not available in preview. <Link className="underline" href="/admin/review">View exceptions</Link></aside>}{children}</>;
}
