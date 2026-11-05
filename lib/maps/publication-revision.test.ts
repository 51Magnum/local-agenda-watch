import {expect,it} from "vitest";
import {mapPublicationRevision} from "./publication-revision";
import {viewportRequest} from "./viewport";
const legacy={id:"nampa"},ada={id:"ada-county",boundaryRevision:"approved-snapshot-1"};
it("changes overview and polygon request keys when an area is published, paused or updated",()=>{
 const before=mapPublicationRevision("index-1",[legacy]);
 const after=mapPublicationRevision("index-1",[legacy,ada]);
 expect(after).not.toBe(before);
 expect(mapPublicationRevision("index-1",[ada,legacy])).toBe(after);
 expect(mapPublicationRevision("index-1",[legacy])).toBe(before);
 expect(mapPublicationRevision("index-1",[legacy,{...ada,boundaryRevision:"approved-snapshot-2"}])).not.toBe(after);
 expect(mapPublicationRevision("index-2",[legacy,ada])).not.toBe(after);
 for(const zoom of [8,10,11,15]){
  const cell:[number,number,number,number]=[-116.3671875,43.2421875,-116.015625,43.59375];
  const old=viewportRequest(cell,zoom,before),fresh=viewportRequest(cell,zoom,after);
  expect(fresh).not.toBe(old);
  const url=new URL(fresh,"https://local.test");
  expect(url.searchParams.get("v")).toBe("publication-v2:"+after);
  expect(url.searchParams.get("compact")).toBe("1");
  expect(viewportRequest(cell,zoom,after)).toBe(fresh);
 }
});
