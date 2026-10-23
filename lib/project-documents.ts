import { uniqueAttachments, uniqueDocumentLinks } from "./case-details";
import type { HearingFeed, Locality } from "@/lib/localities/types";
import { projectHearings, type Project } from "@/lib/projects";

export type ProjectCaseDocuments = {
  id: string;
  label: string;
  portalUrl: string;
  retrievalFailed: boolean;
  documents: { label: string; url: string; sourceUrl: string }[];
};

export async function getProjectDocuments(project: Project, locality: Locality, feed?: HearingFeed): Promise<ProjectCaseDocuments[]> {
  const hearings = projectHearings(project, feed);
  return Promise.all(project.cases.map(async (projectCase) => {
    const hearing = hearings.find((h) => h.appId === projectCase.id);
    const portalUrl = hearing?.energovPlanId && locality.energov
      ? locality.energov.planPortalUrl(hearing.energovPlanId) : projectCase.portalUrl;
    const documents: ProjectCaseDocuments["documents"] = (project.sourceDocuments ?? []).filter((d) => d.caseIds.includes(projectCase.id)).map(({ label, url, sourceUrl }) => ({ label, url, sourceUrl }));
    for (const meeting of hearing?.meetings ?? []) {
      if (meeting.agendaUrl) documents.push({ label: "Agenda — " + meeting.dateLabel, url: meeting.agendaUrl, sourceUrl: meeting.sourceUrl });
      for (const report of meeting.staffReports ?? []) documents.push({ label: "Staff report — " + report.label, url: report.url, sourceUrl: meeting.sourceUrl });
    }
    let retrievalFailed = false;
    if (hearing?.energovPlanId && locality.energov) {
      try {
        const attachments = await locality.energov.getPlanAttachments(hearing.energovPlanId);
        for (const attachment of uniqueAttachments(attachments)) {
          const label = attachment.FileName;
          if (documents.some((d) => d.label === label)) continue;
          if (/decision[\s_-]*letter|reasoned|findings|staff[\s_-]*report|site[\s_-]*plan|prelim(?:inary)?[\s_-]*plat|concept[\s_-]*plan/i.test(label + " " + attachment.FileName)) {
            // EnerGov downloads are portal-mediated; do not invent a file endpoint.
            documents.push({ label, url: portalUrl + "?tab=attachments", sourceUrl: portalUrl });
          }
        }
      } catch (err) {
        retrievalFailed = true;
        console.error("[project-documents] Attachments unavailable for " + projectCase.id, err);
      }
    }
    return { ...projectCase, portalUrl, retrievalFailed,
      documents: uniqueDocumentLinks(documents) };
  }));
}
