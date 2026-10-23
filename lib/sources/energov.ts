/**
 * Client for Tyler Technologies' EnerGov "Self Service" public portal.
 *
 * These portals are deployed per-tenant at `{tenant}-energovpub.tylerhost.net`
 * and expose an ASP.NET Web API at `/apps/selfservice/api/...`. The SPA itself
 * reads the tenant id / name from `/tenants/gettenantslist` on bootstrap and
 * then stamps every subsequent request with `tenantId` / `tenantName` /
 * `Tyler-TenantUrl` headers. We do the same, but with the tenant identifiers
 * pinned via config so we don't make a discovery call on every request.
 */

export type EnerGovConfig = {
  /** e.g. "https://nampaid-energovpub.tylerhost.net" */
  baseUrl: string;
  /** Numeric tenant id as surfaced by /tenants/gettenantslist (Nampa = 1). */
  tenantId: number;
  /** Machine tenant name (e.g. "NampaIDProd"). Sent as both tenantName and Tyler-TenantUrl. */
  tenantName: string;
  /** Browser culture; the portal defaults to "en-US". */
  culture?: string;
};

/** Envelope every EnerGov endpoint wraps its payload in. */
type EnerGovEnvelope<T> = {
  Result: T;
  Success: boolean;
  ErrorMessage: string;
  ValidationErrorMessage: string;
  ConcurrencyErrorMessage: string;
  StatusCode: number;
  BrokenRules: unknown[];
};

/**
 * Fields we care about from GET /energov/plans/{planId}. The real response
 * has ~80 keys; keep this narrow and add as needed.
 */
export type EnerGovPlan = {
  PlanId: string;
  PlanNumber: string;
  PlanType: string;
  PlanTypeId: string | null;
  PlanStatus: string;
  ApplyDate: string | null;
  ExpireDate: string | null;
  CompleteDate: string | null;
  LastActionDate?: string | null;
  ReviewDate?: string | null;
  ReviewStartDate?: string | null;
  ApprovalExpireDate: string | null;
  WorkClassName: string | null;
  Description: string | null;
  MainAddress: string | null;
  MainParcelNumber: string | null;
  AssignedTo: string | null;
  AssignedToEmail: string | null;
  DistrictName: string | null;
  SquareFeet: number | null;
  Value: number | null;
  ProjectName: string | null;
  IVRNumber: string | null;
};

export type EnerGovAttachment = {
  AttachmentID: string;
  ParentID: string;
  FileName: string;
  FilePath: string | null;
  IsFileSecure: boolean;
  IsOnline: boolean;
  Notes: string | null;
};

/**
 * Module id sent on entity-scoped endpoints. The attachments endpoint at
 * least ignores the value (any id from 1-9 returns the same payload) but the
 * parameter is required in the path. Use Plan by default; add more as we
 * extend the surface.
 */
export const EnerGovModule = {
  Permit: 1,
  Plan: 2,
} as const;
export type EnerGovModuleId = (typeof EnerGovModule)[keyof typeof EnerGovModule];

type FetchOpts = {
  /** Seconds before the Next.js data cache revalidates. Default 1 hour. */
  revalidate?: number;
  /** Optional cache tag to allow targeted revalidation later. */
  tag?: string;
};

export type EnerGovClient = {
  getPlan(planId: string, opts?: FetchOpts): Promise<EnerGovPlan | null>;
  getPlanAttachments(
    planId: string,
    opts?: FetchOpts
  ): Promise<EnerGovAttachment[]>;
  getAttachmentMetadata?(attachmentId: string): Promise<Record<string, unknown> | null>;
  downloadAttachment?(attachmentId: string): Promise<Uint8Array>;
  getPlanWorkflowActivities?(planId: string): Promise<Record<string, unknown>[]>;
  /** Public URL for the plan detail page in the citizen portal. */
  planPortalUrl(planId: string, tab?: string): string;
};

export function createEnerGovClient(config: EnerGovConfig): EnerGovClient {
  const culture = config.culture ?? "en-US";
  const baseUrl = config.baseUrl.replace(/\/+$/, "");

  async function call<T>(path: string, opts: FetchOpts, extraHeaders: Record<string, string> = {}): Promise<EnerGovEnvelope<T> | null> {
    const res = await fetch(`${baseUrl}/apps/selfservice/api${path}`, {
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: "application/json, text/plain, */*",
        tenantId: String(config.tenantId),
        tenantName: config.tenantName,
        "Tyler-TenantUrl": config.tenantName,
        "Tyler-Tenant-Culture": culture,
        ...extraHeaders,
      },
      next: {
        revalidate: opts.revalidate ?? 3600,
        ...(opts.tag ? { tags: [opts.tag] } : {}),
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`EnerGov ${res.status} on ${path}`);
    return (await res.json()) as EnerGovEnvelope<T>;
  }

  const attachmentHeaders = (id: string) => ({ FileID: id, FileToken: "", DownloadProvider: "attachment", FileType: "attachment", AllowViewCorrection: "false" });
  const metadata = async (id: string) => {
    const env = await call<Record<string, unknown>>("/energov/attachments/metadata/", { revalidate: 0 }, attachmentHeaders(id));
    return env?.Success && env.Result ? env.Result : null;
  };
  return {
    async getPlan(planId, opts = {}) {
      const env = await call<EnerGovPlan>(`/energov/plans/${planId}`, opts);
      if (!env || !env.Success || !env.Result) return null;
      return env.Result;
    },

    async getPlanWorkflowActivities(planId) {
      const env = await call<Record<string, unknown>[]>(`/energov/workflow/summary/activities/${EnerGovModule.Plan}/${planId}`, { revalidate: 0 });
      return env?.Success && Array.isArray(env.Result) ? env.Result : [];
    },
    getAttachmentMetadata: metadata,
    async downloadAttachment(attachmentId) {
      // Contract verified in the city's public FileDownloadService. IsOnline
      // indicates how a file was uploaded, not whether it is publicly visible.
      const info = await metadata(attachmentId);
      const size = Number(info?.FileSize), token = info?.FileToken;
      if (!info || !Number.isSafeInteger(size) || size <= 0 || size > 45000000 || typeof token !== "string" || !token || !/\.pdf$/i.test(String(info.FileName))) throw new Error("Invalid public PDF metadata");
      const chunks: Uint8Array[] = [];
      const chunkSize = 1000000;
      for (let start = 0; start < size; start += chunkSize) {
        const end = Math.min(size - 1, start + chunkSize - 1);
        const response = await fetch(baseUrl + "/apps/selfservice/api/energov/attachments/rangedownload/", {
          cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
          headers: { ...attachmentHeaders(attachmentId), FileToken: token, range: "bytes=" + start + "-" + end,
            tenantId: String(config.tenantId), "Tyler-TenantUrl": config.tenantName, "Tyler-Tenant-Culture": culture },
        });
        if (!response.ok) throw new Error("Public document HTTP " + response.status);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const range = response.headers.get("content-range");
        if (range !== "bytes " + start + "-" + end + "/" + size || bytes.length !== end - start + 1) throw new Error("Public document range mismatch");
        chunks.push(bytes);
      }
      const bytes = new Uint8Array(Buffer.concat(chunks));
      if (!Buffer.from(bytes.subarray(0, 1024)).includes(Buffer.from("%PDF-"))) throw new Error("Expected public PDF; received an unsupported response");
      return bytes;
    },

    async getPlanAttachments(planId, opts = {}) {
      const env = await call<{ Attachments: EnerGovAttachment[] }>(
        `/energov/entity/attachments/search/entityattachments/${planId}/${EnerGovModule.Plan}/true`,
        opts
      );
      if (!env || !env.Success || !env.Result) return [];
      return env.Result.Attachments ?? [];
    },

    planPortalUrl(planId, tab) {
      const suffix = tab ? `?tab=${encodeURIComponent(tab)}` : "";
      return `${baseUrl}/Apps/SelfService#/plan/${planId}${suffix}`;
    },
  };
}
