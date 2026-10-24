import { approvedImageCheck } from "@/lib/maps/image-policy";
import type { MapCase, MapVisual } from "@/lib/maps/types";
import { getArea } from "@/lib/areas/registry";
import { buildPopupModel, popupProjectName } from "@/lib/maps/popup-model";
import { isWatching, setWatching, subscribeWatches, watchesFromMapCase } from "@/lib/watches";
export const popupDisposers = new WeakMap<HTMLElement, () => void>();
// Use text nodes, rather than HTML strings, for all city-supplied content.
export function popupContent(item: MapCase, onEnlarge: (visual: MapVisual) => void, jurisdiction: string, catalog: MapCase[]): HTMLElement {
  const card = document.createElement("article"); card.className = "law-project-popup";
  const area = getArea(item.areaId ?? jurisdiction);
  const model = item.popup ?? (area ? buildPopupModel(item, area) : { headline: popupProjectName(item.title), projectName: popupProjectName(item.title), progress: [] });
  const title = document.createElement("a"); title.href = item.href; title.className = "law-popup-title"; title.textContent = model.headline; card.append(title);
  if (model.explanation) { const explanation = document.createElement("p"); explanation.className = "law-popup-explanation"; explanation.textContent = model.explanation; card.append(explanation); }
  const watchedProjects = watchesFromMapCase(item.areaId??jurisdiction,item,catalog);
  const allWatched=()=>watchedProjects.every(isWatching);
  const watchLabel = document.createElement("label"); watchLabel.className = "law-watch-toggle";
  const watch = document.createElement("input"); watch.type = "checkbox"; watch.checked = allWatched(); watch.setAttribute("aria-label", "Watch " + item.title);
  const watchText = document.createElement("span"); watchText.textContent = "Watch"; watchLabel.append(watch, watchText);
  watchLabel.addEventListener("click", (event) => event.stopPropagation());
  const watchError = document.createElement("p"); watchError.setAttribute("role", "status"); watchError.hidden = true;
  watch.addEventListener("change", () => { try { const checked=watch.checked;for(const project of watchedProjects)setWatching(project,checked); watchError.hidden = true; } catch (error) { watch.checked = allWatched(); watchError.textContent = error instanceof Error ? error.message : "Could not save your watch."; watchError.hidden = false; } });
  popupDisposers.set(card, subscribeWatches(() => { watch.checked = allWatched(); }));
  if (item.visual && approvedImageCheck(item.visual.approval)) {
    const exhibit = item.visual;
    const figure = document.createElement("figure"); figure.className = "law-popup-visual";
    const enlarge = document.createElement("button"); enlarge.type = "button"; enlarge.className = "law-popup-image-button"; enlarge.setAttribute("aria-label", "Enlarge " + exhibit.label); enlarge.addEventListener("click", (event) => { event.stopPropagation(); onEnlarge(exhibit); });
    const image = document.createElement("img"); image.src = exhibit.src; image.alt = exhibit.alt; image.width = 384; image.height = 160; image.decoding = "async";
    // A missing exhibit must not leave a broken image or hide the case details.
    image.addEventListener("error", () => figure.remove(), { once: true });
    enlarge.append(image); figure.append(enlarge);
    const caption = document.createElement("figcaption");
    const source = document.createElement("a"); source.href = exhibit.sourceUrl; source.target = "_blank"; source.rel = "noopener noreferrer"; source.textContent = exhibit.label.replace(" · March 13, 2026", ", Mar 2026"); caption.append(source);

    figure.append(caption); card.append(figure);
  }
  const tracker = document.createElement("ol"); tracker.className = "law-popup-progress"; tracker.setAttribute("aria-label", "Project progress");
  for (const step of model.progress) {
    const row = document.createElement("li"); row.dataset.state = step.state;
    if (step.state === "current") row.setAttribute("aria-current", "step");
    const symbol = document.createElement("span"); symbol.setAttribute("aria-hidden", "true"); symbol.textContent = step.state === "done" ? "✓ " : step.state === "current" ? "● " : "";
    row.append(symbol, document.createTextNode(step.label)); tracker.append(row);
  }
  if (tracker.children.length) card.append(tracker);
  const link = document.createElement("a"); link.href = item.href; link.textContent = "View project →";
  const footer = document.createElement("div"); footer.className = "law-popup-footer"; const name = document.createElement("span"); name.className = "law-popup-project-name";
  const jurisdictions = item.members ? [...new Set(item.members.map(m => { const a = getArea(m.areaId); return a ? (a.type === "city" ? "City of " : "") + a.name : m.areaId; }))].join(" / ") : item.jurisdictionLabel ?? (area ? (area.type === "city" ? "City of " : "") + area.name : "");
  name.textContent = model.projectName + (jurisdictions ? " · " + jurisdictions : "");
  footer.append(name, link, watchLabel); card.append(footer, watchError);
  return card;
}
