import {afterEach,expect,it,vi} from "vitest";
const h=vi.hoisted(()=>({snapshot:undefined as unknown}));
vi.mock("./store",()=>({readStaging:async()=>h.snapshot}));
vi.mock("../timeline/store",()=>({getEvidenceStore:()=>({read:async()=>({fields:{},documents:{}})})}));
import {privateProject} from "./preview";
afterEach(()=>vi.useRealTimers());
it.each(["2026-10-14T18:00:00Z","2026-10-15T03:00:00Z"])("shows Board and the local today's hearing at %s",async now=>{
 vi.useFakeTimers();vi.setSystemTime(new Date(now));
 h.snapshot={areaId:"ada-county",checkedAt:now,applications:[{recordId:"202600934-S",projectNumber:"202600934",relatedCaseNumbers:[],name:"Two-lot subdivision",type:"Preliminary Plat",description:"Two-lot subdivision",status:"Active",address:"",parcel:[],recordUrl:"https://official.test/202600934",sourceUrl:"https://official.test/202600934",sourceFields:{}}],meetings:[{id:"board",body:"bocc",title:"Board of County Commissioners",date:"2026-10-14",startsAt:"2026-10-15T03:00:00Z",meetingPageUrl:"https://official.test/agenda.pdf",attachments:[],items:[{itemId:"1",title:"Two-lot subdivision",caseNumbers:["202600934-S"],body:"bocc",meetingDateTime:"2026-10-15T03:00:00Z",meetingPageUrl:"https://official.test/agenda.pdf",attachments:[]}]}]};
 const page=await privateProject("ada-county","202600934-S");expect(page?.item.stage).toBe("Council/Board");expect(page?.next?.body).toBe("Board of County Commissioners");expect(page?.noHearing).toBeUndefined();
});
