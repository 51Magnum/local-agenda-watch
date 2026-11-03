import Link from "next/link";
import {isPreview} from "@/lib/runtime-environment";
import {safeReturnTo} from "@/lib/resident-auth";
import SignInForm from "./form";
export const dynamic="force-dynamic";
export const metadata={title:"Sign in",robots:{index:false,follow:false}};
export default async function SignIn({searchParams}:{searchParams:Promise<{next?:string}>}){
 const next=safeReturnTo((await searchParams).next);
 return <main className="mx-auto w-full max-w-lg px-6 py-12"><h1 className="text-3xl font-semibold">Sign in to Local Agenda Watch</h1><p className="mt-4">Use your email to manage your profile and saved pins. No password is needed. The link expires in 15 minutes.</p><p className="mt-3 text-sm">Already receive alerts? Use that same email and your existing watches will appear automatically. Signing in does not start or restart email alerts.</p>{isPreview()?<p className="my-6" role="status">Sign-in and account changes are not available in Preview. All public project pages and maps remain available.</p>:<SignInForm next={next}/>}<p className="mt-6"><Link href="/" className="underline">Keep browsing the public map</Link></p></main>;
}
