import {expect,it,vi} from "vitest";
const h=vi.hoisted(()=>({getPage:vi.fn(),destroy:vi.fn()}));
vi.mock("unpdf",()=>({getDocumentProxy:async()=>({numPages:80,getPage:h.getPage,cleanup:async()=>{},loadingTask:{destroy:h.destroy}})}));
import {pdfIdentity,linkReader} from "./link-evidence";
import {jurisdiction} from "./registry";
import type {StagingSnapshot} from "./store";
import type {SourceHttp} from "./http";
it("reads only the first three physical PDF pages and destroys the document",async()=>{
 h.getPage.mockImplementation(async n=>({getTextContent:async()=>({items:[{str:"page "+n}]}),cleanup:()=>{}}));
 expect(await pdfIdentity(new Uint8Array(),Date.now()+10000)).toBe("page 1\npage 2\npage 3");expect(h.getPage.mock.calls.map(c=>c[0])).toEqual([1,2,3]);expect(h.destroy).toHaveBeenCalledOnce();
});
it("verifies an oversized county report by its configured filename and HTTP PDF availability",async()=>{
 const url="https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=202600273-STAFF_REPORT.pdf&papp=DS_Agendas",request=vi.fn(async()=>({health:{status:200},headers:{"content-type":"application/pdf","content-length":"164090791"},bytes:new Uint8Array()}));
 const snapshot={meetings:[{items:[{caseNumbers:["202600273-ZC"],attachments:[{title:"Staff report",kind:"staff_report",url,sizeBytes:164090791}]}]}]} as StagingSnapshot;
 const result=await linkReader(jurisdiction("ada-county"),snapshot,{request} as unknown as SourceHttp,Date.now()+10000)(url);
 expect(result.status).toBe(200);expect(result.evidenceHash).toMatch(/^[a-f0-9]{64}$/);expect(request).toHaveBeenCalledExactlyOnceWith(url,{method:"HEAD"},Number.MAX_SAFE_INTEGER);
});
