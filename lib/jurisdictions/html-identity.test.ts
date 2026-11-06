import {expect,it,vi} from "vitest";
import {linkReader} from "./link-evidence";
import {jurisdiction} from "./registry";
import type {SourceHttp} from "./http";
import type {StagingSnapshot} from "./store";
it("binds HTML identity to case IDs rather than rotating form tokens",async()=>{
 let token="first",caseId="PLN26-00001";const http={request:vi.fn(async()=>({bytes:new TextEncoder().encode(`<html><input value="${token}">${caseId}</html>`),headers:{"content-type":"text/html"},health:{status:200}}))} as unknown as SourceHttp;
 const snapshot={applications:[],meetings:[]} as unknown as StagingSnapshot,read=linkReader(jurisdiction("boise"),snapshot,http,Date.now()+10000),url="https://boisecityid.iqm2.com/Citizens/Detail_Meeting.aspx?ID=fixture";
 const first=await read(url);token="different-token";expect((await read(url)).evidenceHash).toBe(first.evidenceHash);caseId="PLN26-00002";expect((await read(url)).evidenceHash).not.toBe(first.evidenceHash);
});
