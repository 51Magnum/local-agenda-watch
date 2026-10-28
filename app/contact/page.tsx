import type {Metadata} from "next";
import Link from "next/link";
import CorrectionForm from "@/app/components/correction-form";
export const metadata:Metadata={title:"Contact",alternates:{canonical:"https://www.localagendawatch.com/contact"}};
export default async function Contact({searchParams}:{searchParams:Promise<{project?:string}>}){
 const {project}=await searchParams;
 return <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-14"><Link href="/" className="underline">Back to the map</Link><h1 className="text-3xl font-semibold">Contact</h1><ul className="space-y-3">{[["General","hello"],["Corrections","corrections"],["Privacy and removal requests","privacy"]].map(([label,email])=><li key={email}>{label}: <a className="underline" href={"mailto:"+email+"@localagendawatch.com"}>{email}@localagendawatch.com</a></li>)}</ul><p>For official comments, use the jurisdiction&apos;s hearing record and participation instructions. A report here is not testimony.</p><CorrectionForm project={project?.slice(0,200)}/><Link className="underline" href="/corrections">How we handle corrections</Link></main>;
}
