import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
import {localClock,schedulerWindow} from "./schedule";
it.each(["2026-01-15","2026-07-15"])("provides three triggers in every Denver AM/PM window hour on %s",date=>{
 const workflow=readFileSync(".github/workflows/case-timeline.yml","utf8"),crons=[...workflow.matchAll(/cron: '([^']+)'/g)].map(m=>m[1].split(" "));
 const hours=new Set(crons.flatMap(c=>c[1].split(",").flatMap(range=>{const [a,b=a]=range.split("-").map(Number);return Array.from({length:b-a+1},(_,i)=>a+i);}))),observed=new Map<number,number>();
 for(let h=0;h<24;h++)for(const minute of [0,20,40]){if(!hours.has(h))continue;const instant=new Date(date+"T"+String(h).padStart(2,"0")+":"+String(minute).padStart(2,"0")+":00Z"),clock=localClock(instant,"America/Denver");if(schedulerWindow(instant))observed.set(clock.hour,(observed.get(clock.hour)??0)+1);}
 for(const hour of [5,6,7,8,9,14,15,16,17,18])expect(observed.get(hour),"Denver hour "+hour).toBe(3);
});
