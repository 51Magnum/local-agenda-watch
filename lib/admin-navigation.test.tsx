import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {readdir} from "node:fs/promises";
import path from "node:path";
import {renderToStaticMarkup} from "react-dom/server";
import {NextRequest} from "next/server";
const h=vi.hoisted(()=>({pathname:"/admin",auth:"",counts:{evidence:4,exceptions:3,images:2,corrections:1} as {evidence:number|null;exceptions:number|null;images:number|null;corrections:number|null}}));
vi.mock("next/navigation",()=>({usePathname:()=>h.pathname}));
vi.mock("next/headers",()=>({headers:async()=>new Headers(h.auth?{authorization:h.auth}:{})}));
vi.mock("./admin-attention",()=>({adminAttention:async()=>h.counts}));
import {ADMIN_SECTIONS,adminBreadcrumbs,adminPage,adminPageIntro,adminActionHelp,adminNavigationHtml} from "./admin-navigation";
import AdminShell from "../app/admin/admin-shell";
import AdminLayout from "../app/admin/layout";
import OverviewCards from "../app/admin/overview-cards";
import {proxy} from "../proxy";
const auth="Basic "+Buffer.from("admin:fixture-password").toString("base64");
beforeEach(()=>{vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("REVIEW_ADMIN_PASSWORD","fixture-password");h.auth=auth;h.counts={evidence:4,exceptions:3,images:2,corrections:1};});afterEach(()=>vi.unstubAllEnvs());
async function pageRoutes(dir="app/admin"):Promise<string[]>{const all=await readdir(dir,{withFileTypes:true}),rows:string[]=[];for(const entry of all){const file=path.join(dir,entry.name);if(entry.isDirectory())rows.push(...await pageRoutes(file));else if(entry.name==="page.tsx")rows.push("/"+dir.replaceAll("\\","/").replace(/^app\//,"").replace(/\[area\]/g,"ada-county").replace(/\[caseId\]/g,"ANN-00371-2026").replace(/\[id\]/g,"11111111-1111-4111-8111-111111111111"));}return rows;}
it("groups every admin page and supplies a current breadcrumb and working parent links",async()=>{
 const routes=await pageRoutes();expect(routes.length).toBeGreaterThan(15);const pageSet=new Set(routes);
 for(const route of routes){const crumbs=adminBreadcrumbs(route);expect(crumbs[0].label).toBe("Admin");expect(crumbs.at(-1)?.href).toBeUndefined();if(route!=="/admin"){expect(adminPage(route).section).toBeDefined();expect(crumbs[0].href).toBe("/admin");}for(const crumb of crumbs.filter(c=>c.href)){const target=crumb.href!.split(/[?#]/)[0];expect(pageSet.has(target)).toBe(true);}}
 for(const section of ADMIN_SECTIONS){expect(section.description).toContain("Use this");for(const link of section.links)expect(pageSet.has(link.href)).toBe(true);}
 const standalone=adminNavigationHtml("/admin/residents");for(const section of ADMIN_SECTIONS)for(const link of section.links)expect(standalone).toContain(`href="${link.href}"`);expect(standalone).toContain('aria-current="page"');
});
it.each(["/admin/images/nampa/ANN-00371-2026","/admin/images/crop/abc","/admin/jurisdictions/ada-county/project/202600273","/admin/residents/11111111-1111-4111-8111-111111111111"])("renders active navigation, breadcrumbs, page guidance and an overview return link for %s",route=>{
 h.pathname=route;const html=renderToStaticMarkup(<AdminShell><main>Fixture page</main></AdminShell>);expect(html).toContain('aria-label="Admin navigation"');expect(html).toContain('aria-label="Breadcrumb"');expect(html).toContain('href="/admin"');expect(html).toContain('aria-current="page"');expect(html).toContain(adminPageIntro(route).replace(/&/g,"&amp;"));expect(html).toContain("Fixture page");
});
it("shows a card for each section with real attention counts and explicit unavailable states",async()=>{
 const html=renderToStaticMarkup(await OverviewCards());expect((html.match(/<article/g)??[]).length).toBe(ADMIN_SECTIONS.length);for(const count of ["4 pending evidence fields","3 queued record exceptions","2 flagged or withheld images","1 pending corrections"])expect(html).toContain(count);
 h.counts.images=null;expect(renderToStaticMarkup(await OverviewCards())).toContain("count unavailable");
});
it("preserves admin protection, no-cache headers, preview review access and public routes",async()=>{
 h.auth="";expect(renderToStaticMarkup(await AdminLayout({children:<p>Private fixture</p>}))).not.toContain("Private fixture");h.auth=auth;expect((await AdminLayout({children:<p>Private fixture</p>})).type).toBe(AdminShell);
 for(const route of ["/admin","/admin/audits","/admin/images/crop/abc"]){const denied=proxy(new NextRequest("https://local.test"+route));expect(denied?.status).toBe(401);const allowed=proxy(new NextRequest("https://local.test"+route,{headers:{authorization:auth}}));expect(allowed?.headers.get("cache-control")).toContain("no-store");expect(allowed?.headers.get("x-robots-tag")).toContain("noindex");}
 expect(proxy(new NextRequest("https://local.test/about"))).toBeUndefined();vi.stubEnv("VERCEL_ENV","preview");h.auth="";expect((await AdminLayout({children:<p>Snapshot review</p>})).type).toBe(AdminShell);
});
it.each(["Approve selected","Reject selected","Undo","Select","Hide image","Unhide","Run forced sweep","Rescan this case","Purge unchecked crops & run privacy audit","Save policy","Mark resolved","Send selected test to my address","Remove preview image","Review image from selected document","backfill","qa-report","sample-ai","Save crop","Reset to auto crop"])("explains and confirms the data-changing action %s",label=>{const help=adminActionHelp(label);expect(help.description.length).toBeGreaterThan(30);expect(help.confirm).toBe(true);});
it.each(["Search accounts","Previous page","Select all passing checks","Desktop preview","Cancel","Review plan change"])("does not ask for a data-change confirmation for %s",label=>expect(adminActionHelp(label).confirm).toBe(false));
it("keeps breadcrumb decoding safe for unusual record IDs",()=>expect(()=>adminBreadcrumbs("/admin/images/nampa/CASE%broken")).not.toThrow());
