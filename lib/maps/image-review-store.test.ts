import {expect,it,vi} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {createHash} from "node:crypto";
const harness=vi.hoisted(()=>({db:null as unknown}));vi.mock("pg",()=>({Pool:class{async query(sql:string,params?:unknown[]){const db=harness.db as PGlite;const r=params?.length?await db.query(sql,params):(await db.exec(sql)).at(-1)!;return {...r,rowCount:r.affectedRows??r.rows.length};}}}));
import {publicImageReviews,imageAssetIsActive,saveImageReview,selectImage,hideImage,unhideImage,imageReviews,displayedImageReviews,saveImageCheck,reserveImageCheck} from "./image-review-store";
import {IMAGE_CHECK_VERSION} from "./image-policy";
it("preserves manual picks in SQL, enforces privacy before Select, and only reclaims transient stale checks",async()=>{
 const db=new PGlite();harness.db=db;vi.stubEnv("DATABASE_URL","postgres://test");try{
 const approval={version:IMAGE_CHECK_VERSION,type:"site plan",pageHash:createHash("sha256").update("plan").digest("hex"),contains_personal_info:false,confidence:.96,checkedAt:new Date().toISOString()};
 const row={id:"one",areaId:"nampa",caseIds:["A"],title:"Site plan",sourceUrl:"https://city.test/plan.pdf",originalSrc:"src",outcome:"accepted" as const,checkedAt:new Date().toISOString(),visual:{approval,src:"src",fullSizeUrl:"src",alt:"plan",label:"Site plan",sourceUrl:"https://city.test/plan.pdf",kind:"proposal" as const}};
 await saveImageReview(row);expect(await imageAssetIsActive("nampa","src")).toBe(true);await selectImage("one");await saveImageReview({...row,title:"Automatic replacement"});expect((await imageReviews())[0]).toMatchObject({manual:true,selected:true,title:"Site plan"});
 await hideImage("one");expect(await imageAssetIsActive("nampa","src")).toBe(false);expect(await publicImageReviews("nampa",["A"])).toEqual([]);expect(displayedImageReviews(await imageReviews())).toEqual([]);await unhideImage("one");expect(displayedImageReviews(await imageReviews())).toHaveLength(1);
 await saveImageReview({...row,id:"bad",visual:{...row.visual,approval:{...approval,contains_personal_info:true}}});await expect(selectImage("bad")).rejects.toThrow("privacy");
 await saveImageCheck("old",{...approval,type:"classification unavailable",checkedAt:new Date(Date.now()-86400001).toISOString()});expect(await reserveImageCheck("old",{...approval,type:"unchecked"})).toBe(true);expect(await reserveImageCheck("old",{...approval,type:"unchecked"})).toBe(false);
 }finally{vi.unstubAllEnvs();await db.close();}
});
