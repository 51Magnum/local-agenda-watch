import { areaPath } from "@/lib/areas/registry";



const APEX_ORIGIN = "https://www.localagendawatch.com";

export type LocalityContext = {
  /** True when the request arrived on a recognised locality subdomain. */
  onSubdomain: boolean;
  /** The subdomain slug (e.g. "nampa") when on a locality subdomain, else null. */
  subdomainSlug: string | null;
};

/**
 * Determine whether the current request is being served on a locality
 * subdomain (e.g. nampa.localagendawatch.com). Reading the host header opts
 * the caller into dynamic rendering.
 */
export async function getLocalityContext(): Promise<LocalityContext> {
  // Locality subdomains redirect to canonical area paths in proxy.ts.
  return {onSubdomain:false,subdomainSlug:null};
}

/**
 * Build a link to a path within a locality that works in both apex and
 * subdomain contexts.
 *
 * - On the apex domain: `/{locality}{subpath}` (e.g. `/nampa/toll-brothers`)
 * - On the matching locality subdomain: `{subpath}` (e.g. `/toll-brothers`)
 *
 * `subpath` may be empty, "/", or start with "/".
 */
export function localityHref(
  locality: string,
  subpath: string,
  ctx: LocalityContext
): string {
  const normalized =
    subpath === "" || subpath === "/"
      ? ""
      : subpath.startsWith("/")
        ? subpath
        : `/${subpath}`;

  void ctx;
  return areaPath(locality) + normalized;
}

/** Absolute URL of the apex home page, for cross-origin "Home" links. */
export function apexHomeUrl(): string {
  return `${APEX_ORIGIN}/`;
}
