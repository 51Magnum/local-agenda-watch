import "server-only";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {SESSION_COOKIE,residentForSession,safeReturnTo} from "./resident-auth";
export async function currentResident(){return residentForSession((await cookies()).get(SESSION_COOKIE)?.value);}
export async function requireResident(returnTo="/profile"){
 const resident=await currentResident();if(!resident)redirect("/sign-in?next="+encodeURIComponent(safeReturnTo(returnTo)));return resident;
}
