import {expect,it,vi} from "vitest";
import {proposeFix} from "./ai-fixer";
import type {Application} from "./adapters/types";
const app:Application={recordId:"202600934-S",relatedCaseNumbers:[],name:"Source proposal",description:"Conditional Use for a contractor yard",type:"Conditional Use",status:"Active",address:"",parcel:[],sourceUrl:"https://official.test/202600934",recordUrl:"https://official.test/202600934",sourceFields:{}};
it("uses a mocked model and rejects invented title facts",async()=>{
 const model=vi.fn().mockResolvedValue({title:"Approved school",hideDocuments:false,reason:"Fixture"});
 expect((await proposeFix("ada-county",app,model)).autoApply).toBe(false);
 model.mockResolvedValue({title:"Contractor yard",hideDocuments:true,reason:"Source words; hide more"});const result=await proposeFix("ada-county",app,model);expect(result.autoApply).toBe(true);expect(result.proposal?.sourceUrls).toEqual([app.sourceUrl]);
});
it("defers over-budget work into review",async()=>{
 const model=vi.fn().mockRejectedValue(Error("AI work deferred: jurisdiction dollar cap reached"));const result=await proposeFix("ada-county",app,model);expect(result.autoApply).toBe(false);expect(result.deferred).toContain("cap reached");
});
