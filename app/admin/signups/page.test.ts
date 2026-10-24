import {afterEach,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
const mocks=vi.hoisted(()=>({authorized:vi.fn(),list:vi.fn()}));
vi.mock("next/headers",()=>({headers:async()=>new Headers()}));
vi.mock("@/lib/timeline/auth",()=>({authorizedReviewer:mocks.authorized}));
vi.mock("@/lib/areas/requests",()=>({listCoverageRequests:mocks.list}));
import Signups from "./page";
afterEach(()=>vi.resetAllMocks());
it("never reads or renders private signups without admin authentication",async()=>{
 mocks.authorized.mockReturnValue(false);const html=renderToStaticMarkup(await Signups({searchParams:Promise.resolve({})}));expect(html).toContain("Admin access requires");expect(mocks.list).not.toHaveBeenCalled();
});
it("shows submitted locations and interests only in the protected admin view",async()=>{
 mocks.authorized.mockReturnValue(true);mocks.list.mockResolvedValue({items:[{id:"one",kind:"follow",areaRequested:"Example County",address:"Main & First",interests:"New housing",email:"neighbor@example.test",location:null,createdAt:"2026-10-24T02:00:00Z"}],counts:{all:1,follow:1,coverage:0},total:1,page:1,pageSize:50});
 const html=renderToStaticMarkup(await Signups({searchParams:Promise.resolve({kind:"follow"})}));expect(html).toContain("Main &amp; First");expect(html).toContain("New housing");expect(html).toContain("neighbor@example.test");expect(html).toContain("America/Denver");expect(mocks.list).toHaveBeenCalledWith({kind:"follow",page:1});
});
