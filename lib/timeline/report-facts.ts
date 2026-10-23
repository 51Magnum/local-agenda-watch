import { EXTRACTED_KEYS, type ExtractedKey, type PageText, type SourceDocument } from "./types";
import type { Extraction } from "./extract";

/** Conservative pilot fallback for the verified shared Braeburn report.
 * It supplies no recommendations or outcomes and never uses an uncited number.
 */
export function explicitReportFacts(document: SourceDocument, caseId: string, pages: PageText[]): Extraction {
  const facts = Object.fromEntries(EXTRACTED_KEYS.map((key) => [key, { value: null, page: null, quote: null, confidence: 0 }])) as Extraction;
  if (document.kind !== "staff-report" || !["ANN-00371-2026", "SPP-00184-2026"].includes(caseId) || !document.url.includes("historyId=acf18754-7101-48d9-b4ea-f8398342a0fa") || !pages.find((p) => p.page === 1)?.text.includes(caseId)) return facts;
  const take = (key: ExtractedKey, pattern: RegExp, value: (match: RegExpMatchArray) => string) => {
    for (const page of pages) {
      const match = page.text.replace(/\s+/g, " ").match(pattern);
      if (match) { facts[key] = { value: value(match), quote: match[0], page: page.page, confidence: page.method === "native" ? 0.99 : 0.9 }; return; }
    }
  };
  take("units", /Original Concept:\s*Development of (\d[\d,]*) single-family detached unit lots[^.]*\./i, (m) => m[1].replace(/,/g, "") + " single-family detached lots");
  take("acres", /Overall Total site area\s*\(acres\)\s*(\d+(?:\.\d+)?)/i, (m) => m[1]);
  take("zoningRequested", /Annexation\s*&\s*Zoning to (RS\d+(?:,\s*RS\d+)*(?:\s+and\s+RS\d+)?)\s*\(Single-Family Residential\)/i, (m) => m[1] + " (Single-Family Residential)");
  take("requestSummary", /Annexation\s*&\s*Zoning to [^.]+?representing[^.]+?\([A-Z]{2,6}-\d{5}-\d{4}[^)]*\)\./i, (m) => m[0]);
  take("keyConditions", /Frontage road improvements will be required[^.]*Section 9-3-1[^.]*including,[\s\S]*?Cruse Ln\/Pit Ln[^.]*full pavement widening\./i, (m) => m[0]);
  return facts;
}
