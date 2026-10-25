import type{Metadata}from"next";
import MapHome from "./components/maps/map-home";
import{SITE_ORIGIN}from"@/lib/site-config";
export const revalidate=3600;
export const metadata:Metadata={title:{absolute:"Local Agenda Watch | Rezoning, Annexation & Public Hearing Tracker"},description:"Find development proposals, rezoning requests and public hearings near you, with links to official records.",alternates:{canonical:SITE_ORIGIN+"/"},openGraph:{title:"What's being built near you? | Local Agenda Watch",description:"Explore development proposals, public hearings and decisions using official local records.",url:SITE_ORIGIN,images:[SITE_ORIGIN+"/opengraph-image"]}};
export default function Home(){return <MapHome/>;}
