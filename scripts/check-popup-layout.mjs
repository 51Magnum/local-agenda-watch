import { createRequire } from "node:module";
import { createServer } from "node:http";
import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { cropMainPanel } from "../lib/maps/preview-crop.ts";
import { CASE_EVIDENCE } from "../lib/case-evidence.ts";
const require2 = createRequire(import.meta.url), { chromium } = require2(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright");
const root = process.cwd(), data = await (await fetch("https://www.localagendawatch.com/api/maps/nampa")).json();
const ids = ["ANN-00368-2026", "ANN-00371-2026", "CUP-00415-2026"];
const cases = ids.map((id) => data.cases.find((c) => c.id === id));
assert.ok(cases.every(Boolean));
const americrete = CASE_EVIDENCE[ids[0]].applicationCopy;
cases[0].popup = { ...cases[0].popup, headline: americrete.headline, explanation: americrete.explanation };
const assets = /* @__PURE__ */ new Map();
for (const c of cases) if (c.visual) {
  const bytes = Buffer.from(await (await fetch(new URL(c.visual.src, "https://www.localagendawatch.com"))).arrayBuffer());
  assets.set(c.visual.src, bytes);
  assets.set(c.visual.src + "?preview=main-v1", (await cropMainPanel(bytes)).image);
}
const bundle = await build({ stdin: { contents: `import{popupContent}from'./app/components/maps/popup-card';window.renderCard=(item)=>{const old=document.querySelector('article');old?.remove();document.querySelector('.maplibregl-popup-content').append(popupContent(item,(v)=>{window.enlarged=v.fullSizeUrl},'nampa',[]));};`, resolveDir: root, loader: "ts" }, bundle: true, format: "iife", write: false, tsconfig: root + "/tsconfig.json" });
const css = await readFile("app/components/maps/map.css", "utf8");
const server = createServer((req, res) => {
  if (req.url === "/card.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
    return;
  }
  const asset = assets.get(req.url);
  if (asset) {
    res.setHeader("Content-Type", "image/webp");
    res.end(asset);
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end(`<style>body{font-family:Arial;margin:0}.law-map{height:768px;padding:0}.law-case-popup{position:absolute;top:20px;left:16px}*{box-sizing:border-box}${css}</style><main class="law-map"><div class="law-case-popup"><div class="maplibregl-popup-content"></div></div></main><script src="/card.js"></script>`);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto("http://127.0.0.1:" + port);
  const report = [];
  for (const width of [640, 520, 519, 358]) for (const c of cases) {
    await page.evaluate(({ c: c2, width: width2 }) => {
      document.querySelector(".law-case-popup").style.width = width2 + "px";
      window.renderCard(c2);
    }, { c, width });
    await page.locator("article").waitFor();
    if (c.visual) await page.waitForFunction(() => {
      const img = document.querySelector("article img");
      return img?.complete && img.naturalWidth > 0;
    });
    const box = await page.locator("article").evaluate((el) => {
      const img = el.querySelector("figure"), text = el.querySelector(".law-popup-copy"), a = el.getBoundingClientRect(), b = img?.getBoundingClientRect(), t = text.getBoundingClientRect();
      return { width: a.width, height: a.height, scroll: el.scrollHeight > el.clientHeight + 1, imageWidth: b?.width, imageHeight: b?.height, textWidth: t.width, textX: t.x - a.x, display: getComputedStyle(el).display };
    });
    assert.equal(box.scroll, false);
    assert.ok(box.height < 650, JSON.stringify(box));
    assert.ok(box.width <= 640);
    if (c.visual) {
      if (width >= 520) {
        assert.equal(box.display, "grid");
        assert.ok(Math.abs(box.imageWidth / width - 0.4) < 0.01);
        assert.ok(Math.abs(box.textWidth / width - 0.6) < 0.01);
      } else {
        assert.equal(box.imageHeight, 140);
        assert.equal(box.textX, 0);
      }
      await page.getByRole("button", { name: /Enlarge/ }).click();
      assert.equal(await page.evaluate(() => window.enlarged), c.visual.fullSizeUrl);
    } else {
      assert.equal(box.imageWidth, void 0);
      assert.equal(box.textWidth, width);
    }
    report.push({ case: c.id, cardWidth: width, ...box });
  }
  await mkdir("output", { recursive: true });
  await writeFile("output/popup-v2-layout-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cases: 3, widths: [640, 520, 519, 358], checks: report.length, passed: true }));
} finally {
  await browser?.close();
  await new Promise((r) => server.close(() => r()));
}
