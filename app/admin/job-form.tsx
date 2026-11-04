"use client";
import {useState} from "react";
export default function AdminJobForm({action,label}:{action:string;label:string}){
 const [busy,setBusy]=useState(false),[result,setResult]=useState("");
 return <form action={action} method="post" className="space-y-3" onSubmit={async event=>{event.preventDefault();setBusy(true);setResult("Running. Stay on this page to see the saved job result.");try{const response=await fetch(action,{method:"POST",body:new FormData(event.currentTarget)}),data=await response.json();setResult(JSON.stringify({httpStatus:response.status,...data},null,2));}catch{setResult("The connection ended. Check the existing run report before retrying.");}finally{setBusy(false);}}}><button className="rounded border p-3" disabled={busy}>{busy?"Running…":label}</button><pre role="status" className="max-h-96 overflow-auto whitespace-pre-wrap text-sm">{result}</pre></form>;
}
