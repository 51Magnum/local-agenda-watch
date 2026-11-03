"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
export default function VerifySignIn(){
 const started=useRef(false),[message,setMessage]=useState("Signing you in…");
 useEffect(()=>{
  if(started.current)return;started.current=true;
  const token=new URLSearchParams(window.location.hash.slice(1)).get("token");
  window.history.replaceState(null,"",window.location.pathname);
  if(!token){queueMicrotask(()=>setMessage("This sign-in link is missing or was already opened. Request a new link."));return;}
  void fetch("/api/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})}).then(async response=>{const data=await response.json();if(response.ok&&typeof data.redirect==="string")window.location.replace(data.redirect);else setMessage(data.error??"This link expired or was already used. Request a new link.");}).catch(()=>setMessage("Sign-in is temporarily unavailable. Request a new link and try again."));
 },[]);
 return <main className="mx-auto max-w-lg space-y-5 px-6 py-12"><h1 className="text-3xl font-semibold">Email sign-in</h1><p role="status">{message}</p><Link href="/sign-in" className="underline">Request a new sign-in link</Link><noscript>Enable JavaScript to finish signing in from your one-time email link.</noscript></main>;
}
