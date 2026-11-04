import {headers} from "next/headers";
import {authorizedReviewer} from "@/lib/timeline/auth";
import {isPreview} from "@/lib/runtime-environment";
import AdminShell from "./admin-shell";
import "./admin.css";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
export default async function AdminLayout({children}:{children:React.ReactNode}){
 if(!isPreview()&&!authorizedReviewer((await headers()).get("authorization")))return <main>Admin access required.</main>;
 return <AdminShell>{children}</AdminShell>;
}
