import {PGlite} from "@electric-sql/pglite";
import {expect,it,vi} from "vitest";
const harness=vi.hoisted(()=>({db:undefined as unknown as PGlite}));
vi.mock("pg",()=>({Pool:class{async query(sql:string,params:unknown[]=[]){if(sql.startsWith("CREATE TABLE")){await harness.db.exec(sql);return {rows:[]};}return harness.db.query(sql,params);}}}));
import {readFlumSnapshot,readMapSnapshot} from "./store";
it("projects only bbox matches inside Postgres, including legacy polygons without cached bounds",async()=>{
 const db=new PGlite();harness.db=db;vi.stubEnv("DATABASE_URL","test");
 try{
  await readMapSnapshot("sample",{bounds:[0,0,.01,.01],includeFlum:false});
  const geometry=(x:number,size:number)=>({type:"Polygon",coordinates:[[[x,x],[x+size,x],[x+size,x+size],[x,x+size],[x,x]]]});
  const snapshot={version:1,jurisdiction:"sample",updatedAt:"now",warnings:[],cases:[{id:"near",geometry:geometry(0,.001)},{id:"large",geometry:geometry(-1,2)},{id:"far",geometry:geometry(2,.001)},{id:"citywide",geometry:null}]};
  await db.query("INSERT INTO law_map_cache VALUES('sample',$1::jsonb)",[JSON.stringify(snapshot)]);
  const result=await readMapSnapshot("sample",{bounds:[0,0,.01,.01],includeFlum:false});
  expect(result?.cases.map(c=>c.id)).toEqual(["near","large"]);
  expect(JSON.stringify(result)).not.toContain('"far"');
  await db.query("INSERT INTO law_flum_cache VALUES('sample',$1::jsonb)",[JSON.stringify({updatedAt:"now",legend:[],geojson:{type:"FeatureCollection",features:snapshot.cases.filter(c=>c.geometry).map(c=>({type:"Feature",geometry:c.geometry,properties:{category:c.id}}))}})]);
  const flum=await readFlumSnapshot("sample",{bounds:[0,0,.01,.01]});
  expect(flum?.geojson.features.map(f=>f.properties?.category)).toEqual(["near","large"]);
 }finally{vi.unstubAllEnvs();await db.close();}
});
