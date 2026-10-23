import { load } from "cheerio";
const ORIGIN = "https://nampaid-energovpub.tylerhost.net";
/** Inspect only the city's public client assets; no case contents or server environment are returned. */
export async function nampaPublicClientHints() {
  const read = async (url: string) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!response.ok) throw new Error("Public client HTTP " + response.status);
    return response.text();
  };
  try {
    const html = await read(ORIGIN + "/Apps/SelfService");
    const $ = load(html);
    const scripts = $("script[src]").map((_i, e) => new URL($(e).attr("src")!, ORIGIN + "/Apps/SelfService/").href).get()
      .filter((url) => new URL(url).origin === ORIGIN);
    const selected = scripts.filter((url) => /app|bundle|main/i.test(new URL(url).pathname) && !/vendor|jquery|angular|bootstrap/i.test(url)).slice(-4);
    const matches: string[] = [];
    await Promise.all(selected.map(async (url) => {
      try {
        const js = await read(url);
        for (const match of js.matchAll(/.{0,100}(?:energov\/[^"'\s]{0,100}(?:attachment|workflow)|downloadAttachment|DownloadAttachment|downloadFile|DownloadFile).{0,150}/g)) {
          if (matches.length < 24) matches.push(match[0]);
        }
      } catch { /* Public asset availability is diagnostic, never blocks ingestion. */ }
    }));
    return { scripts: scripts.map((url) => new URL(url).pathname), matches };
  } catch (error) { return { error: error instanceof Error ? error.message : "Public client unavailable" }; }
}
