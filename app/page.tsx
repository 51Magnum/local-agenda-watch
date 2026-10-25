import type{Metadata}from"next";
import MapHome from "./components/maps/map-home";
import{SITE_ORIGIN}from"@/lib/site-config";
export const revalidate=3600;
const defaultMetadata:Metadata={title:{absolute:"Local Agenda Watch | Rezoning, Annexation & Public Hearing Tracker"},description:"Find development proposals, rezoning requests and public hearings near you, with links to official records.",alternates:{canonical:SITE_ORIGIN+"/"},openGraph:{title:"What's being built near you? | Local Agenda Watch",description:"Explore development proposals, public hearings and decisions using official local records.",url:SITE_ORIGIN,images:[SITE_ORIGIN+"/opengraph-image"]}};
export default async function Home({searchParams=Promise.resolve({})}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}={}){const {projectFromShare}=await import("@/lib/project-seo"),{projectJsonLd}=await import("@/lib/project-seo-jsonld"),data=await projectFromShare((await searchParams).project);return <>{data&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(projectJsonLd(data)).replace(/</g,"\\u003c")}}/>}<MapHome/></>;}

export async function generateMetadata({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}):Promise<Metadata>{const {projectFromShare,projectMetadata}=await import("@/lib/project-seo"),data=await projectFromShare((await searchParams).project);return data?projectMetadata(data):defaultMetadata;}
