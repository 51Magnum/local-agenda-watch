/**
 * Scraper for the City of Nampa CivicPlus "Upcoming Public Hearings" page:
 *   https://www.cityofnampa.us/1433/Upcoming-Public-Hearings
 *
 * The page is hand-edited HTML inside the CMS's rich-text editor, but each
 * meeting follows a stable pattern: one <h3> with "<date> - <body> - ..."
 * immediately followed by one <ul>. Every <li> hyperlinks each APPID to its
 * EnerGov plan URL, and may end with an <em> continuance note.
 */

export const NAMPA_PUBLIC_HEARINGS_URL =
  "https://www.cityofnampa.us/1433/Upcoming-Public-Hearings";

export const NAMPA_CIVICPLUS_HEARINGS_URL =
  "https://id-nampa2.civicplus.com/1433/Upcoming-Public-Hearings";

const ENERGOV_GUID_RE =
  /\/plan\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

const APPID_RE = /^[A-Z]{2,6}-[0-9]{5}-[0-9]{4}$/;

export type NampaScheduledBody = "P&Z" | "City Council";

export type NampaScheduledHearing = {
  /** ISO date, e.g. "2026-04-28" */
  date: string;
  /** Human-facing date, e.g. "April 28, 2026" */
  dateLabel: string;
  /** Canonical body identifier */
  body: NampaScheduledBody;
  /** Human-facing body, e.g. "Planning & Zoning Commission" */
  bodyLabel: string;
  /** City plan number, e.g. "CMA-00069-2026" */
  appId: string;
  /** Case description (the <li> text minus APPIDs and continuance notes) */
  description: string;
  /** "Continued to ..." note attached to this (appId, date) row, if present */
  continuedNote: string | null;
  /** EnerGov plan GUID extracted from the anchor href, if any */
  energovPlanId: string | null;
  /** Absolute source URL (always the Upcoming Public Hearings page) */
  sourceUrl: string;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function text(fragment: string): string {
  return decodeEntities(stripTags(fragment)).replace(/\s+/g, " ").trim();
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const HEADING_RE =
  /^([A-Za-z]+) ([0-9]{1,2}), ([0-9]{4})\s*[-\u2013]\s*(Planning & Zoning|City Council)\b/;

function parseHeading(headingText: string): Pick<
  NampaScheduledHearing,
  "date" | "dateLabel" | "body" | "bodyLabel"
> | null {
  const m = headingText.match(HEADING_RE);
  if (!m) return null;
  const [, month, day, year, bodyRaw] = m;
  const mi = MONTHS[month.toLowerCase()];
  if (!mi) return null;
  const iso = `${year}-${String(mi).padStart(2, "0")}-${day.padStart(2, "0")}`;
  const body: NampaScheduledBody =
    bodyRaw === "Planning & Zoning" ? "P&Z" : "City Council";
  const bodyLabel =
    body === "P&Z" ? "Planning & Zoning Commission" : "City Council";
  const cap = month[0].toUpperCase() + month.slice(1).toLowerCase();
  return { date: iso, dateLabel: `${cap} ${day}, ${year}`, body, bodyLabel };
}

const PAIR_RE =
  /<h3\b[^>]*>([\s\S]*?)<\/h3>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/g;
const LI_RE = /<li\b[^>]*>([\s\S]*?)<\/li>/g;
const ANCHOR_RE = /<a\s[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
const EM_RE = /<em\b[^>]*>([\s\S]*?)<\/em>/;
const SECTION_RE = /<h2[^>]*>[^<]*(?:<em[^>]*>)?\s*Upcoming Public Hearings[\s\S]*/i;

export function parseNampaScheduledHearings(
  html: string,
): NampaScheduledHearing[] {
  const section = html.match(SECTION_RE)?.[0];
  if (!section) return [];
  const out: NampaScheduledHearing[] = [];
  PAIR_RE.lastIndex = 0;
  for (let pair; (pair = PAIR_RE.exec(section)); ) {
    const heading = parseHeading(text(pair[1]));
    if (!heading) continue;
    const ulInner = pair[2];
    LI_RE.lastIndex = 0;
    for (let li; (li = LI_RE.exec(ulInner)); ) {
      const liInner = li[1];
      const anchors: Array<{ appId: string; href: string }> = [];
      ANCHOR_RE.lastIndex = 0;
      for (let a; (a = ANCHOR_RE.exec(liInner)); ) {
        const anchorText = text(a[2]).replace(/[(),]/g, "").trim();
        if (APPID_RE.test(anchorText)) anchors.push({ appId: anchorText, href: a[1] });
      }
      if (anchors.length === 0) continue;
      const emMatch = liInner.match(EM_RE);
      const rawNote = emMatch ? text(emMatch[1]) : "";
      const continuedNote = rawNote.replace(/^\*+|\*+$/g, "").trim() || null;
      const description = text(
        liInner.replace(/<a\b[\s\S]*?<\/a>/g, "").replace(/<em\b[\s\S]*?<\/em>/g, ""),
      )
        .replace(/\s*\([\s,]*\)\s*$/, "")
        .trim();
      for (const { appId, href } of anchors) {
        out.push({
          ...heading,
          appId,
          description,
          continuedNote,
          energovPlanId: href.match(ENERGOV_GUID_RE)?.[1]?.toLowerCase() ?? null,
          sourceUrl: NAMPA_PUBLIC_HEARINGS_URL,
        });
      }
    }
  }
  return out;
}

export async function getNampaScheduledHearings(
  options: { revalidate?: number; tag?: string } = {},
): Promise<NampaScheduledHearing[]> {
  const { revalidate = 1800, tag = "nampa:scheduled" } = options;
  const failures: unknown[] = [];
  for (const url of [NAMPA_CIVICPLUS_HEARINGS_URL, NAMPA_PUBLIC_HEARINGS_URL]) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(15000),
        next: { revalidate, tags: [tag] },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const html = await res.text();
      if (/challenge/i.test(res.headers.get("cf-mitigated") ?? "") ||
          /<title[^>]*>\s*(?:Just a moment|Attention Required)|cf-chl-|challenge-platform|Checking your browser|Performing security verification|Enable JavaScript and cookies to continue/i.test(html)) {
        throw new Error("Cloudflare challenge page");
      }
      // A changed template or an interstitial is not a valid empty schedule.
      if (!SECTION_RE.test(html)) throw new Error("Upcoming Public Hearings section missing");
      return parseNampaScheduledHearings(html);
    } catch (err) {
      console.error("[nampa:scheduled] Failed to fetch " + url, err);
      failures.push(err);
    }
  }
  throw new AggregateError(failures, "Meeting schedule temporarily unavailable");
}
