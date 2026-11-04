"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useRef,useState} from "react";
import {ADMIN_SECTIONS,adminBreadcrumbs,adminPage,adminPageIntro,adminActionHelp} from "@/lib/admin-navigation";
export default function AdminShell({children}:{children:React.ReactNode}){
 const pathname=usePathname(),content=useRef<HTMLDivElement>(null),page=adminPage(pathname),crumbs=adminBreadcrumbs(pathname);
 const [menuOpen,setMenuOpen]=useState(false);
 useEffect(()=>{
  const root=content.current;if(!root)return;const approved=new WeakMap<HTMLFormElement,number>();
  const label=(button:HTMLElement)=>button.textContent?.replace(/\s+/g," ").trim()||button.getAttribute("aria-label")||"Continue";
  function describe(){for(const button of root!.querySelectorAll<HTMLButtonElement>("button")){if((button.textContent?.trim().length??0)<2||button.classList.contains("law-pane-close"))continue;const post=!!button.form&&button.form.method.toLowerCase()!=="get",help=adminActionHelp(label(button),post);button.dataset.adminHelp=help.description;button.title=help.description;if(!button.hasAttribute("aria-label")||button.dataset.adminNamed){button.setAttribute("aria-label",label(button));button.dataset.adminNamed="true";}}}
  describe();const observer=new MutationObserver(describe);observer.observe(root,{childList:true,subtree:true,characterData:true});
  function confirm(button:HTMLElement,form?:HTMLFormElement|null){
   if(button.closest('[data-admin-confirm-managed]'))return true;
   const help=adminActionHelp(label(button),!!form&&form.method.toLowerCase()!=="get");
   return !help.confirm||window.confirm(help.description+"\n\nContinue?");
  }
  const click=(event:Event)=>{const button=(event.target as Element)?.closest<HTMLElement>("button");if(!button||!root.contains(button))return;const form=(button as HTMLButtonElement).form;if(!confirm(button,form)){event.preventDefault();event.stopImmediatePropagation();}else if(form)approved.set(form,Date.now());};
  const submit=(event:Event)=>{const form=event.target as HTMLFormElement;if(!root.contains(form)||form.method.toLowerCase()==="get")return;const time=approved.get(form);approved.delete(form);if(time&&Date.now()-time<1500)return;const button=(event as SubmitEvent).submitter??form.querySelector("button");if(button&&!confirm(button,form)){event.preventDefault();event.stopImmediatePropagation();}};
  document.addEventListener("click",click,true);document.addEventListener("submit",submit,true);
  return()=>{observer.disconnect();document.removeEventListener("click",click,true);document.removeEventListener("submit",submit,true);};
 },[pathname]);
 return <div className="law-admin-shell"><aside className="law-admin-sidebar"><Link prefetch={false} className="law-admin-brand" href="/admin">LAW Admin</Link><button className="law-admin-menu-toggle" aria-expanded={menuOpen} aria-controls="law-admin-nav" onClick={()=>setMenuOpen(!menuOpen)}>Admin menu</button><nav id="law-admin-nav" data-open={menuOpen} aria-label="Admin navigation"><Link prefetch={false} href="/admin" aria-current={pathname==="/admin"?"page":undefined}>Overview & health</Link>{ADMIN_SECTIONS.map(section=><section key={section.id}><h2>{section.label}</h2>{section.links.map(link=><Link prefetch={false} key={link.href} href={link.href} onClick={()=>setMenuOpen(false)} aria-current={page.link?.href===link.href?"page":undefined}>{link.label}</Link>)}</section>)}</nav><Link prefetch={false} href="/">Return to public map</Link></aside><div className="law-admin-main"><nav aria-label="Breadcrumb" className="law-admin-breadcrumb"><ol>{crumbs.map((crumb,i)=><li key={i}>{crumb.href?<Link prefetch={false} href={crumb.href}>{crumb.label}</Link>:<span aria-current="page">{crumb.label}</span>}</li>)}</ol></nav>{page.section&&<header className="law-admin-intro"><h2>{page.section.label}</h2><p>{adminPageIntro(pathname)}</p><p className="text-sm">Actions show a short explanation. Changes ask for confirmation; existing review and delivery gates still apply.</p></header>}<div ref={content} className="law-admin-page-content">{children}</div></div></div>;
}
