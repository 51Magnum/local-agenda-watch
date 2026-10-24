import { load } from "cheerio";
import type { EvidenceStore } from "./store";
import { allowedSource, sourceRequest } from "./source-access";
import { digest } from "./ingest";
export type LibraryFile={url:string;title:string};
/** Resume public library traversal. No login, challenge bypass, guessed document IDs, or private files. */
export async function walkLibrary(areaId:string,caseId:string,root:string,store:EvidenceStore,deadline:number):Promise<LibraryFile[]>{
 const key=areaId+":"+caseId+":"+digest(root),snapshot=await store.read();
 const queue=[...(snapshot.folderQueues?.[key]??[root])],files:LibraryFile[]=[];
 const seen=new Set<string>();let visited=0;
 while(queue.length&&Date.now()<deadline&&visited<5){
  const url=queue.shift()!;if(seen.has(url)||!allowedSource(url,areaId))continue;seen.add(url);visited++;
  try{
   const response=await sourceRequest(url,areaId);const type=response.headers.get("content-type")??"";
   if(/application\/pdf/i.test(type)){await response.body?.cancel();files.push({url,title:decodeURIComponent(new URL(url).pathname.split("/").at(-1)??"Official report")});continue;}
   const text=await response.text(),$=load(text),host=new URL(url).hostname;
   // Public SharePoint folders expose subfolders/files through their documented REST lists.
   if(host.endsWith(".sharepoint.com")){
    const parsed=new URL(url),folder=parsed.searchParams.get("id")??parsed.searchParams.get("RootFolder");
    if(folder){const base=folder.split("/").slice(0,folder.startsWith("/sites/")?3:1).join("/");
     const endpoint=new URL(base+"/_api/web/GetFolderByServerRelativeUrl('"+folder.replace(/'/g,"''")+"')?$expand=Folders,Files",url).href;
     if(!seen.has(endpoint)&&!queue.includes(endpoint))queue.push(endpoint);
    }
    if(/json/i.test(type)){
     const data=JSON.parse(text),node=data.d??data;
     for(const child of [...(node.Files?.results??node.Files??[]),...(node.Folders?.results??node.Folders??[])]){
      if(!child.ServerRelativeUrl||/sign[ _-]*in|attendance|sign[ _-]*up/i.test(child.Name??""))continue;
      const next=new URL(child.ServerRelativeUrl,url).href;
      if(/\.pdf$/i.test(child.Name??""))files.push({url:next,title:child.Name});else if(!seen.has(next))queue.push(next);
     }
    }
   }
   // WebLink and public meeting pages: descend only explicit library/attachment links.
   for(const node of $("iframe[src],embed[src],object[data]").toArray()){
    const raw=$(node).attr("src")??$(node).attr("data");if(!raw)continue;const next=new URL(raw,url).href;
    if(allowedSource(next,areaId)&&/\.pdf|Download|MetaViewer/i.test(next))files.push({url:next,title:$(node).attr("title")??"Meeting packet"});
   }
   for(const a of $("a[href]").toArray()){
    if($(a).closest("nav,.breadcrumb,#breadcrumbs").length)continue;
    const href=$(a).attr("href")!,title=($(a).text()||$(a).attr("title")||href).replace(/\s+/g," ").trim();
    if(/sign[ _-]*in|attendance|sign[ _-]*up/i.test(title))continue;
    let next:string;try{next=new URL(href,url).href;}catch{continue;}
    if(!allowedSource(next,areaId)||seen.has(next))continue;
    if(/\.pdf(?:[?#]|$)|DownloadDocument|DocView.*(?:id=)|ElectronicFile\.aspx|GetDocumentDownload/i.test(next))files.push({url:next,title});
    else if(/Browse\.aspx|(?:agency|application|staff|plan|exhibit|attachment|comment|report|findings|decision|minutes)/i.test(title+" "+href)&&new URL(next).hostname===host&&!queue.includes(next))queue.push(next);
   }
  }catch(error){queue.unshift(url);await store.mutate(s=>{(s.folderQueues??={})[key]=queue;});throw error;}
 }
 // Exhausted roots are revisited on later runs to discover newly posted files.
 await store.mutate(s=>{(s.folderQueues??={})[key]=queue.length?queue:[root];});
 const finalNames=new Set(files.filter(f=>/final/i.test(f.title)).map(f=>f.title.replace(/final|draft/gi,"").toLowerCase()));
 return [...new Map(files.filter(f=>!/draft/i.test(f.title)||!finalNames.has(f.title.replace(/final|draft/gi,"").toLowerCase())).map(f=>[f.url,f])).values()];
}
