import type { ScheduleState } from "./schedule";
import type { AreaDefinition } from "@/lib/areas/registry";
export function timelineHealth(state: ScheduleState, areas: Record<string, AreaDefinition>, now = new Date()) {
  const warnings: string[] = [];
  for (const area of Object.values(areas).filter(a => a.status === "live" && a.timeline)) {
    const last = state.sweeps?.[area.id]?.lastSuccessAt;
    if (!last || now.getTime() - Date.parse(last) > 30 * 3600000) warnings.push(`${area.name}: ${last ? "last successful source sweep " + last + " is over 30 hours old" : "no successful source sweep recorded"}.`);
  }
  for (const meeting of state.meetings) {
    if (now.getTime() - Date.parse(meeting.date + "T23:59:59Z") <= 14 * 86400000) continue;
    const pending = meeting.caseIds.filter(id => !meeting.resolvedCaseIds.includes(id));
    if (pending.length) warnings.push(`${areas[meeting.areaId]?.name ?? meeting.areaId} · ${meeting.body} · ${meeting.date}: result pending over 14 days for ${pending.join(", ")}.`);
  }
  return warnings;
}
